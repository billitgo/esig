<template>
  <div class="pdf-viewer">
    <div v-if="!pdfDoc" class="empty-hint">
      <p>请先上传 PDF 文件</p>
      <p class="sub">支持多页 PDF，单击页面任意位置即可盖章</p>
    </div>
    <div v-else class="page-wrap" ref="pageWrap">
      <canvas ref="pdfCanvas" class="pdf-canvas"></canvas>
      <canvas ref="stampCanvas" class="stamp-canvas"></canvas>
      <div v-if="selectedStamp" class="float-tip">
        已选中印章：可拖动调整位置，按 Delete 或点击下方「删除选中」移除
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { fabric } from 'fabric';
import { renderPageToCanvas } from '../utils/pdfRenderer.js';
import { sliceSealImage, sliceToDataURL } from '../utils/sealSlice.js';

const props = defineProps({
  pdfDoc: { type: Object, default: null },
  pageNumber: { type: Number, default: 1 },
  numPages: { type: Number, default: 0 },
  sealImageEl: { type: Object, default: null }, // HTMLImageElement
  sealDataUrl: { type: String, default: '' },
  sealSizePt: { type: Number, default: 119.06 },
  opacity: { type: Number, default: 1 },
  crossPageEnabled: { type: Boolean, default: false },
  crossPageOffsetY: { type: Number, default: 80 },
  crossPageWidthPt: { type: Number, default: 80 },
  stamps: { type: Array, default: () => [] },
});

const emit = defineEmits(['update:stamps', 'update:crossPageOffsetY', 'update:selected']);

const pdfCanvas = ref(null);
const stampCanvas = ref(null);
const pageWrap = ref(null);

let fabricCanvas = null;
let ghostImage = null; // 跟随鼠标的半透明预览章
let lastClientX = 0; // 真实鼠标屏幕坐标（window 级监听，供空格键盖章使用）
let lastClientY = 0;
const selectedStamp = ref(null);
let selectedStampId = null;

/** 创建跟随鼠标的幽灵印章（半透明预览，单击时在此落章） */
async function createGhost() {
  if (!props.sealDataUrl || !props.sealImageEl) return null;
  const aspect = props.sealImageEl.height / props.sealImageEl.width;
  const w = props.sealSizePt;
  const h = w * aspect;
  const ghost = await new Promise((resolve) => {
    fabric.Image.fromURL(props.sealDataUrl, (image) => resolve(image));
  });
  ghost.set({
    // 注意：初始位置必须在画布内，否则 fabric 离屏优化会导致对象永不渲染
    left: 0,
    top: 0,
    scaleX: w / props.sealImageEl.width,
    scaleY: h / props.sealImageEl.height,
    opacity: 0.45,
    visible: false, // 初始隐藏，鼠标移入画布后显示并跟随
    selectable: false,
    evented: false,
    name: 'ghost-seal',
  });
  return ghost;
}

/** 加载一张印章图片为 fabric.Image 对象 */
function createStampObject(s) {
  return new Promise((resolve) => {
    fabric.Image.fromURL(s.url, (img) => {
      img.set({
        left: s.x,
        top: s.y,
        scaleX: s.scaleX,
        scaleY: s.scaleY,
        opacity: s.opacity ?? 1,
        angle: s.angle ?? 0,
        // 取消缩放：锁定所有缩放轴（保留拖动移动、旋转、删除）
        lockScalingX: true,
        lockScalingY: true,
        lockUniScaling: true,
      });
      img.stampId = s.id; // 标记 id，供重建后恢复选中
      resolve(img);
    });
  });
}

/** 印章对象被拖动/缩放/旋转时同步回数据 */
function bindStampEvents(img, s) {
  // 拖动/缩放/旋转过程中：只更新内存数据（fabric 自身渲染保证跟手），
  // 不 emit，避免父组件 watch 触发 renderPage 重建导致拖动中断
  const syncData = () => {
    s.x = img.left;
    s.y = img.top;
    s.scaleX = img.scaleX;
    s.scaleY = img.scaleY;
    s.angle = img.angle;
  };
  const commit = () => emit('update:stamps', [...props.stamps]);
  img.on('moving', syncData);
  img.on('scaling', syncData);
  img.on('rotating', syncData);
  img.on('mouseup', commit); // 交互结束时提交一次，供撤销/导出使用
  img.on('selected', () => {
    selectedStampId = s.id;
    selectedStamp.value = s;
    emit('update:selected', s.id);
  });
  img.on('deselected', () => {
    if (selectedStampId === s.id) {
      selectedStampId = null;
      selectedStamp.value = null;
      emit('update:selected', null);
    }
  });
}

/** 渲染骑缝章预览切片（当前页右边缘，横向切片：一章宽的 1/N 竖条） */
async function renderCrossPagePreview() {
  if (!props.crossPageEnabled || !props.sealImageEl || !fabricCanvas) return;
  const count = Math.max(1, Math.min(props.numPages, props.pdfDoc.numPages));
  const pageIndex = props.pageNumber - 1;
  if (pageIndex >= count) return;

  const slices = sliceSealImage(props.sealImageEl, count);
  const url = sliceToDataURL(slices[pageIndex]);
  // 横向切片：每片源宽 = 印章宽/页数，渲染宽 = 总宽/页数；高度为完整章高比例
  const scale = props.crossPageWidthPt / props.sealImageEl.width;
  const sliceW = props.crossPageWidthPt / count;
  const sliceH = props.sealImageEl.height * scale;
  const pageW = pdfCanvas.value.width;
  const pageH = pdfCanvas.value.height;

  const img = await new Promise((resolve) => {
    fabric.Image.fromURL(url, (image) => resolve(image));
  });

  // 骑缝章对象：只允许垂直拖动，用于调整骑缝章位置
  img.set({
    // 骑缝章必须紧贴页面右边缘（接缝处），不留边距
    left: pageW - sliceW,
    top: props.crossPageOffsetY,
    scaleX: scale,
    scaleY: scale,
    selectable: true,
    lockMovementX: true,
    lockScalingX: true,
    lockScalingY: true,
    lockRotation: true,
    opacity: 0.85,
    name: 'cross-page-seal',
  });
  img.on('moving', () => {
    const maxTop = Math.max(0, pageH - sliceH);
    const top = Math.min(Math.max(img.top, 0), maxTop);
    img.top = top;
    emit('update:crossPageOffsetY', top);
  });
  img.on('selected', () => {
    selectedStampId = 'cross';
    selectedStamp.value = { id: 'cross', name: '骑缝章' };
    emit('update:selected', 'cross');
  });
  img.on('deselected', () => {
    selectedStampId = null;
    selectedStamp.value = null;
    emit('update:selected', null);
  });

  fabricCanvas.add(img);
}

/** 在指定坐标处落一枚章（鼠标单击与空格键共用） */
async function stampAt(pointer) {
  if (!props.sealDataUrl || !props.sealImageEl) return;
  const aspect = props.sealImageEl.height / props.sealImageEl.width;
  const w = props.sealSizePt;
  const h = w * aspect;

  const newStamp = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    page: props.pageNumber,
    x: pointer.x - w / 2,
    y: pointer.y - h / 2,
    width: props.sealImageEl.width,
    height: props.sealImageEl.height,
    scaleX: w / props.sealImageEl.width,
    scaleY: h / props.sealImageEl.height,
    opacity: props.opacity,
    angle: 0,
    url: props.sealDataUrl,
  };

  const img = await createStampObject(newStamp);
  bindStampEvents(img, newStamp);
  fabricCanvas.add(img);
  fabricCanvas.setActiveObject(img);
  emit('update:stamps', [...props.stamps, newStamp]);
}

/** 空格键：在真实光标位置盖章一次 */
function onKeydown(e) {
  if (e.code !== 'Space' || !fabricCanvas || !props.sealDataUrl) return;
  // 焦点在输入控件时交给控件，不拦截空格
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  e.preventDefault(); // 阻止空格滚动页面/触发聚焦按钮
  // 用当前真实鼠标位置换算画布坐标（不依赖 fabric 的 mouse:move 是否触发）
  const pointer = fabricCanvas.getPointer({ clientX: lastClientX, clientY: lastClientY });
  // 光标在画布外时不盖章
  if (pointer.x < 0 || pointer.y < 0 || pointer.x > fabricCanvas.width || pointer.y > fabricCanvas.height) return;
  stampAt(pointer);
}

/** window 级鼠标移动记录（保证任何位置移动都能追踪到真实光标） */
function onWindowMouseMove(e) {
  lastClientX = e.clientX;
  lastClientY = e.clientY;
}

/** 重建当前页：渲染 PDF + 叠加当前页印章 + 骑缝章预览 */
async function renderPage() {
  if (!props.pdfDoc) return;
  const { width, height } = await renderPageToCanvas(props.pdfDoc, props.pageNumber, pdfCanvas.value);

  if (fabricCanvas) {
    fabricCanvas.dispose();
    fabricCanvas = null;
  }
  fabricCanvas = new fabric.Canvas(stampCanvas.value);
  fabricCanvas.setDimensions({ width, height });
  fabricCanvas.selection = true;

  // 当前页普通印章
  const pageStamps = props.stamps.filter((s) => s.page === props.pageNumber);
  for (const s of pageStamps) {
    const img = await createStampObject(s);
    bindStampEvents(img, s);
    fabricCanvas.add(img);
  }

  // 重建后恢复之前选中的印章（落章/翻页后保持选中态）
  if (selectedStampId && selectedStampId !== 'cross') {
    const target = fabricCanvas.getObjects().find((o) => o.stampId === selectedStampId);
    if (target) fabricCanvas.setActiveObject(target);
  }

  // 骑缝章预览
  await renderCrossPagePreview();

  // 跟随鼠标的幽灵章：鼠标移动时实时预览盖章位置
  ghostImage = await createGhost();
  if (ghostImage) fabricCanvas.add(ghostImage);

  fabricCanvas.on('mouse:move', (e) => {
    if (!ghostImage || !props.sealDataUrl) return;
    const pointer = fabricCanvas.getPointer(e.e);
    if (e.target) {
      // 鼠标悬停在已有印章/对象上时隐藏幽灵章，避免干扰
      ghostImage.visible = false;
    } else {
      ghostImage.visible = true;
      const w = ghostImage.getScaledWidth();
      const h = ghostImage.getScaledHeight();
      ghostImage.set({ left: pointer.x - w / 2, top: pointer.y - h / 2 });
    }
    fabricCanvas.requestRenderAll();
  });

  // 左键单击空白处 => 在此位置加盖一枚电子章（幽灵章所在位置即鼠标位置）
  fabricCanvas.on('mouse:down', async (e) => {
    if (e.target) return; // 点到了已有对象，不盖章
    if (!props.sealDataUrl || !props.sealImageEl) return;
    const pointer = fabricCanvas.getPointer(e.e);
    await stampAt(pointer);
  });

  // 键盘 Delete 删除选中对象
  fabricCanvas.on('mouse:up', () => {
    // 空实现占位，删除统一走外部按钮
  });
}

watch(
  () => [props.pdfDoc, props.pageNumber, props.stamps, props.crossPageEnabled, props.crossPageOffsetY, props.crossPageWidthPt, props.sealDataUrl, props.sealSizePt],
  async () => {
    if (props.pdfDoc && pdfCanvas.value) {
      await renderPage();
    }
  },
  { flush: 'post' }, // 等待 DOM 更新后 canvas ref 才可用
);

onMounted(() => {
  window.addEventListener('keydown', onKeydown);
  window.addEventListener('mousemove', onWindowMouseMove);
  if (props.pdfDoc) renderPage();
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  window.removeEventListener('mousemove', onWindowMouseMove);
  if (fabricCanvas) fabricCanvas.dispose();
});
</script>

<style scoped>
.pdf-viewer {
  position: relative;
  height: 100%;
  overflow: auto;
  background: #525659;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 16px;
}
.empty-hint {
  color: #cfd2d6;
  text-align: center;
  margin-top: 120px;
  font-size: 16px;
}
.empty-hint .sub {
  color: #9aa0a6;
  font-size: 13px;
  margin-top: 8px;
}
.page-wrap {
  position: relative;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);
}
.pdf-canvas,
.stamp-canvas {
  position: absolute;
  top: 0;
  left: 0;
}
.stamp-canvas {
  z-index: 2;
}
.float-tip {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  z-index: 10;
}
</style>
