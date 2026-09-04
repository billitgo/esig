import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// 配置 pdf.js worker（Vite 下用 ?url 方式导入 worker 文件）
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

/**
 * 加载 PDF 文件字节，返回 pdfjs 文档对象
 * @param {ArrayBuffer} data
 */
export async function loadPdf(data) {
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  return pdf;
}

/**
 * 渲染指定页到 canvas（scale=1，像素与 PDF 点坐标 1:1，便于导出换算）
 * @param {object} pdf pdfjs 文档
 * @param {number} pageNumber 页码（1 起）
 * @param {HTMLCanvasElement} canvas
 * @returns {Promise<{viewport, width, height}>}
 */
export async function renderPageToCanvas(pdf, pageNumber, canvas) {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const context = canvas.getContext('2d');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: context, viewport }).promise;
  return { viewport, width: viewport.width, height: viewport.height };
}
