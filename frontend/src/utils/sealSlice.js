/**
 * 骑缝章切片工具
 *
 * 原理：将印章图按"需要盖章的页数 N"沿水平方向等分为 N 片（竖条），
 * 第 i 页右边缘贴第 i 片；所有页叠放后拼合即恢复完整印章，形成跨页骑缝效果。
 * 垂直拖动：通过 offsetY（渲染目标位置的垂直偏移）整体上下移动。
 */

/**
 * 将印章图横向切成 N 片（每片为竖条，保留完整高度），返回每片 canvas
 * @param {HTMLImageElement} img 印章图
 * @param {number} pageCount 页数 N
 * @returns {HTMLCanvasElement[]} 长度 N 的切片数组
 */
export function sliceSealImage(img, pageCount) {
  const count = Math.max(1, pageCount);
  const sliceW = img.width / count;
  const slices = [];
  for (let i = 0; i < count; i++) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sliceW));
    canvas.height = Math.max(1, Math.round(img.height));
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, i * sliceW, 0, sliceW, img.height, 0, 0, sliceW, img.height);
    slices.push(canvas);
  }
  return slices;
}

/**
 * 获取切片预览用的 dataURL
 * @param {HTMLCanvasElement} canvas
 */
export function sliceToDataURL(canvas) {
  return canvas.toDataURL('image/png');
}

/**
 * 计算骑缝章每页切片的渲染尺寸（横向切片：每页显示一章宽的 1/N 竖条，高度为完整章高比例）
 * @param {number} sealWidth 印章原图宽度（px）
 * @param {number} sealHeight 印章原图高度（px）
 * @param {number} pageCount 页数
 * @param {number} targetWidthPt 骑缝章目标总宽（pt，预览时=px）
 * @returns {{sliceWidth, sliceHeight, sliceSrcWidth}}
 */
export function calcCrossPageSize(sealWidth, sealHeight, pageCount, targetWidthPt) {
  const count = Math.max(1, pageCount);
  const scale = targetWidthPt / sealWidth;
  return {
    sliceWidth: targetWidthPt / count, // 每页渲染宽度 = 总宽 / 页数
    sliceHeight: sealHeight * scale, // 每页渲染高度 = 完整章高比例
    sliceSrcWidth: sealWidth / count, // 每片源图宽度
  };
}
