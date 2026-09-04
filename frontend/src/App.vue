<template>
  <div class="app">
    <aside class="sidebar">
      <h1 class="logo">电子盖章系统</h1>

      <!-- 后端状态 -->
      <div class="section">
        <div class="section-title">服务状态</div>
        <div class="backend-status" :class="backendOk ? 'ok' : 'err'">
          {{ backendOk ? '后端服务已连接' : '后端服务未连接（仅本地盖章可用）' }}
        </div>
      </div>

      <!-- 文件上传 -->
      <div class="section">
        <div class="section-title">1. 上传 PDF 文件</div>
        <input ref="pdfInput" type="file" accept="application/pdf" hidden @change="handlePdfUpload" />
        <button class="btn primary" @click="pdfInput.click()" :disabled="uploadingPdf">
          {{ uploadingPdf ? '加载中…' : fileName || '选择 PDF 文件' }}
        </button>
        <div v-if="fileName" class="file-info">{{ fileName }} · 共 {{ numPages }} 页</div>
      </div>

      <!-- 印章 -->
      <div class="section">
        <div class="section-title">2. 上传电子印章（PNG）</div>
        <input ref="sealInput" type="file" accept="image/png" hidden @change="handleSealUpload" />
        <button class="btn" @click="sealInput.click()">
          {{ sealDataUrl ? '更换印章' : '选择 PNG 印章' }}
        </button>
        <div v-if="sealImageEl" class="seal-preview">
          <img :src="sealDataUrl" alt="印章预览" />
          <span>{{ sealImageEl.width }} × {{ sealImageEl.height }}px</span>
        </div>

        <div class="field">
          <label>印章尺寸</label>
          <div class="seg">
            <button :class="{ on: sealSizeMode === 'standard' }" @click="sealSizeMode = 'standard'">标准 42mm</button>
            <button :class="{ on: sealSizeMode === 'small' }" @click="sealSizeMode = 'small'">小 21mm</button>
          </div>
        </div>

        <div class="field">
          <label>透明度：{{ Math.round(opacity * 100) }}%</label>
          <input type="range" min="0.3" max="1" step="0.05" v-model.number="opacity" />
        </div>
      </div>

      <!-- 盖章记录 -->
      <div class="section records">
        <div class="section-title">盖章记录: 共({{ stamps.length }})条记录</div>
        <div class="record-list">
          <div v-for="s in stamps" :key="s.id" class="record-item">
            <span class="record-page">第{{ s.page }}页</span>
            <span class="record-time">{{ s.createdAt || '—' }}</span>
            <button class="record-del" @click="deleteRecord(s.id)">删除</button>
          </div>
          <div v-if="stamps.length === 0" class="record-empty">暂无盖章记录</div>
        </div>
      </div>

      <!-- 骑缝章 -->
      <div class="section">
        <div class="section-title">3. 骑缝章</div>
        <label class="switch-row">
          <input type="checkbox" v-model="crossPageEnabled" />
          <span>{{ crossPageEnabled ? '已开启：印章已切片并紧贴每页右边缘（接缝处），拖动预览章可调整上下位置' : '开启骑缝章（盖于文件右侧接缝处）' }}</span>
        </label>
        <div class="field" v-if="crossPageEnabled">
          <label>骑缝章宽度：{{ crossPageWidthPt }}pt</label>
          <input type="range" min="40" max="200" step="5" v-model.number="crossPageWidthPt" />
        </div>
      </div>

      <!-- 操作 -->
      <div class="section actions">
        <div class="section-title">4. 导出</div>
        <button class="btn primary" @click="handleExport" :disabled="!canExport">
          {{ canExport ? '下载盖章 PDF' : '请先上传 PDF 并盖章' }}
        </button>
        <div class="row">
          <button class="btn small" @click="deleteSelected" :disabled="!selectedStampId">删除选中</button>
          <button class="btn small" @click="undoLast" :disabled="stamps.length === 0">撤销上一枚</button>
        </div>
      </div>

      <!-- 分页 -->
      <div class="section" v-if="pdfDoc">
        <div class="section-title">页码</div>
        <div class="pager">
          <button class="btn small" @click="goPage(pageNumber - 1)" :disabled="pageNumber <= 1">‹</button>
          <input type="number" :value="pageNumber" min="1" :max="numPages" @change="onPageInput" />
          <span>/ {{ numPages }}</span>
          <button class="btn small" @click="goPage(pageNumber + 1)" :disabled="pageNumber >= numPages">›</button>
        </div>
      </div>
    </aside>

    <main class="main">
      <PdfViewer
        :pdf-doc="pdfDoc"
        :page-number="pageNumber"
        :num-pages="numPages"
        :seal-image-el="sealImageEl"
        :seal-data-url="sealDataUrl"
        :seal-size-pt="sealSizePt"
        :opacity="opacity"
        :cross-page-enabled="crossPageEnabled"
        :cross-page-offset-y="crossPageOffsetY"
        :cross-page-width-pt="crossPageWidthPt"
        :stamps="stamps"
        @update:stamps="stamps = $event"
        @update:cross-page-offset-y="crossPageOffsetY = $event"
        @update:selected="selectedStampId = $event"
      />
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, markRaw } from 'vue';
import PdfViewer from './components/PdfViewer.vue';
import { loadPdf } from './utils/pdfRenderer.js';
import { exportStampedPdf } from './utils/stampExport.js';
import { checkHealth } from './api/index.js';

// ---- 状态 ----
const pdfInput = ref(null);
const sealInput = ref(null);

const pdfData = ref(null);
const pdfDoc = ref(null);
const fileName = ref('');
const uploadingPdf = ref(false);
const pageNumber = ref(1);
const numPages = ref(0);

const sealImageEl = ref(null);
const sealDataUrl = ref('');
const sealSizeMode = ref('standard'); // standard=42mm | small=21mm
const sealSizePt = computed(() => (sealSizeMode.value === 'standard' ? 119.06 : 59.53));
const opacity = ref(1);

const crossPageEnabled = ref(false);
// 骑缝章默认垂直位置：80 + 一个标准章位(119.06)，即骑缝章整体下移一个章的位置
const crossPageOffsetY = ref(199.06);
const crossPageWidthPt = ref(100);

const stamps = ref([]);
const selectedStampId = ref(null);

const backendOk = ref(false);

const canExport = computed(() => !!pdfDoc.value && (stamps.value.length > 0 || crossPageEnabled.value));

// ---- 上传 ----
async function handlePdfUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  uploadingPdf.value = true;
  try {
    const buf = await file.arrayBuffer();
    // 注意：pdf.js getDocument({data}) 会转移（transfer）ArrayBuffer 所有权，
    // 原始 buffer 会被 detach，因此 pdf.js 使用副本、导出保留原始 buffer
    const doc = await loadPdf(buf.slice(0));
    pdfData.value = buf;
    // 关键：pdf.js 对象含私有字段（#pagePromises），必须 markRaw 防止 Vue 响应式代理包裹，
    // 否则 getPage() 会报 "Cannot read private member"（pdf.js v4 + Vue3 已知问题）
    pdfDoc.value = markRaw(doc);
    fileName.value = file.name;
    numPages.value = doc.numPages;
    pageNumber.value = 1;
    stamps.value = [];
    selectedStampId.value = null;
    crossPageOffsetY.value = 199.06;
  } catch (err) {
    alert(`PDF 加载失败：${err.message}`);
  } finally {
    uploadingPdf.value = false;
    e.target.value = '';
  }
}

function handleSealUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const url = reader.result;
    const img = new Image();
    img.onload = () => {
      sealImageEl.value = img;
      sealDataUrl.value = url;
    };
    img.src = url;
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}

// ---- 分页 ----
function goPage(p) {
  if (!pdfDoc.value) return;
  pageNumber.value = Math.min(Math.max(1, p), numPages.value);
}

function onPageInput(e) {
  goPage(parseInt(e.target.value, 10) || 1);
}

// ---- 删除 / 撤销 ----
/** 按 id 删除一枚章（盖章记录列表的删除按钮） */
function deleteRecord(id) {
  stamps.value = stamps.value.filter((s) => s.id !== id);
  if (selectedStampId.value === id) selectedStampId.value = null;
}

function deleteSelected() {
  if (!selectedStampId.value) return;
  if (selectedStampId.value === 'cross') return; // 骑缝章对象不通过此按钮删除
  deleteRecord(selectedStampId.value);
}

function undoLast() {
  stamps.value = stamps.value.slice(0, -1);
}

// ---- 导出 ----
async function handleExport() {
  if (!pdfDoc.value) return;
  try {
    const crossPage = crossPageEnabled.value
      ? {
          enabled: true,
          pageCount: numPages.value,
          offsetY: crossPageOffsetY.value,
          widthPt: crossPageWidthPt.value,
          sealImage: sealImageEl.value,
          sealWidth: sealImageEl.value.width,
          sealHeight: sealImageEl.value.height,
        }
      : { enabled: false };

    const bytes = await exportStampedPdf(pdfData.value, stamps.value, crossPage);
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (fileName.value || 'document').replace(/\.pdf$/i, '') + '-盖章.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert(`导出失败：${err.message}`);
  }
}

// ---- 键盘 Delete 删除选中 ----
function onKeydown(e) {
  if ((e.key === 'Delete' || e.key === 'Backspace') && selectedStampId.value && selectedStampId.value !== 'cross') {
    deleteSelected();
  }
}

// ---- 后端健康检查 ----
async function initHealth() {
  try {
    await checkHealth();
    backendOk.value = true;
  } catch {
    backendOk.value = false;
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown);
  initHealth();
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
});
</script>
