import {
  PDFDocument,
  pushGraphicsState,
  popGraphicsState,
  concatTransformationMatrix,
} from 'pdf-lib';
import { sliceSealImage } from './sealSlice.js';

/**
 * 导出盖章后的 PDF（pdf-lib 无损嵌入，参考开源项目 pdf-stamp 的坐标换算方案）
 *
 * 坐标约定：
 *  - 预览阶段 fabric 坐标为像素，scale=1 时 1px = 1pt（与 PDF 页面点坐标一致）
 *  - fabric y 轴向下，pdf-lib y 轴向上：pdfY = pageHeight - y - height
 *
 * @param {ArrayBuffer} pdfData 原始 PDF
 * @param {Array} stamps 普通印章列表 [{page, x, y, width, height, scaleX, scaleY, opacity, angle, url}]
 * @param {object} crossPage 骑缝章配置 {enabled, pageCount, offsetY, widthPt, sealImage, sealWidth, sealHeight}
 * @returns {Promise<Uint8Array>} 盖章后的 PDF 字节
 */
export async function exportStampedPdf(pdfData, stamps, crossPage) {
  const pdfDoc = await PDFDocument.load(pdfData);

  // ---- 普通印章 ----
  for (const s of stamps) {
    const pageIndex = s.page - 1;
    if (pageIndex < 0 || pageIndex >= pdfDoc.getPageCount()) continue;
    const page = pdfDoc.getPage(pageIndex);
    const pageHeight = page.getHeight();

    const image = await pdfDoc.embedPng(s.url);
    const drawWidth = s.width * (s.scaleX || 1);
    const drawHeight = s.height * (s.scaleY || 1);
    const x = s.x;
    const y = pageHeight - s.y - drawHeight;

    const originX = x;
    const originY = y + drawHeight;
    const angle = ((s.angle || 0) * Math.PI) / 180;

    if (angle !== 0) {
      // 绕图片左下角旋转（与 pdf-stamp 一致）
      page.pushOperators(
        pushGraphicsState(),
        concatTransformationMatrix(1, 0, 0, 1, originX, originY),
        concatTransformationMatrix(Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle), 0, 0),
        concatTransformationMatrix(1, 0, 0, 1, -originX, -originY),
      );
    }

    page.drawImage(image, { x, y, width: drawWidth, height: drawHeight, opacity: s.opacity ?? 1 });

    if (angle !== 0) {
      page.pushOperators(popGraphicsState());
    }
  }

  // ---- 骑缝章：横向等分切片（竖条），逐页贴到右边缘 ----
  if (crossPage?.enabled) {
    const { pageCount, offsetY, widthPt, sealImage, sealWidth, sealHeight } = crossPage;
    const count = Math.min(pageCount, pdfDoc.getPageCount());
    if (sealImage && count > 0) {
      const slices = sliceSealImage(sealImage, count);
      const scale = widthPt / sealWidth;
      const sliceDrawW = widthPt / count; // 每页渲染宽度 = 总宽 / 页数
      const sliceDrawH = sealHeight * scale; // 每页渲染高度 = 完整章高比例

      for (let i = 0; i < count; i++) {
        const page = pdfDoc.getPage(i);
        const pageWidth = page.getWidth();
        const pageHeight = page.getHeight();

        const img = await pdfDoc.embedPng(slices[i].toDataURL('image/png'));
        // 骑缝章紧贴右边缘（接缝处），不留边距
        const x = pageWidth - sliceDrawW;
        const y = pageHeight - offsetY - sliceDrawH;

        page.drawImage(img, { x, y, width: sliceDrawW, height: sliceDrawH, opacity: 1 });
      }
    }
  }

  return pdfDoc.save();
}
