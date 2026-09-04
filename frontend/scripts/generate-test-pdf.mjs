/**
 * 生成 3 页 A4 测试 PDF（模拟合同文本），用于盖章功能验证
 * 运行: node scripts/generate-test-pdf.mjs
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../assets/test-contract.pdf');

const doc = await PDFDocument.create();
doc.registerFontkit(fontkit);

// 使用系统中文字体（黑体），pdf-lib 子集化嵌入避免体积过大
const FONT_CANDIDATES = [
  'C:/Windows/Fonts/simhei.ttf',
  'C:/Windows/Fonts/msyh.ttc',
  'C:/Windows/Fonts/simsun.ttc',
];
let font = null;
for (const f of FONT_CANDIDATES) {
  try {
    if (fs.existsSync(f)) {
      const fontBytes = fs.readFileSync(f);
      font = await doc.embedFont(fontBytes, { subset: true });
      break;
    }
  } catch {
    // 尝试下一个
  }
}
if (!font) {
  console.error('未找到可用的中文字体（simhei.ttf / msyh.ttc / simsun.ttc）');
  process.exit(1);
}
const pageW = 595.28;
const pageH = 841.89;

const contents = [
  {
    title: '技术服务合同（第 1 页）',
    body: [
      '甲方：示例科技有限公司',
      '乙方：示例服务有限公司',
      '',
      '一、服务内容',
      '乙方为甲方提供电子签名与盖章系统部署服务，包括系统安装、',
      '配置、培训与一年期维护支持。',
      '',
      '二、服务期限',
      '本合同自签署之日起生效，服务期为期一年。',
      '服务期内乙方应提供 7×24 小时响应支持。',
    ],
  },
  {
    title: '技术服务合同（第 2 页）',
    body: [
      '三、合同金额与支付',
      '本合同总金额为人民币伍万元整（¥50,000.00），含税。',
      '支付方式：合同签署后支付 50%，验收合格后支付剩余 50%。',
      '',
      '四、双方权利义务',
      '甲方应提供必要的部署环境与配合人员；',
      '乙方应保证交付成果符合合同约定技术标准。',
    ],
  },
  {
    title: '技术服务合同（第 3 页）',
    body: [
      '五、违约责任',
      '任何一方违反本合同约定，应承担违约责任并赔偿对方损失。',
      '',
      '六、争议解决',
      '因本合同引起的争议，双方应友好协商解决；协商不成的，',
      '提交甲方所在地人民法院诉讼解决。',
      '',
      '七、其他',
      '本合同一式两份，甲乙双方各执一份，具有同等法律效力。',
      '（以下无正文）',
    ],
  },
];

for (const c of contents) {
  const page = doc.addPage([pageW, pageH]);
  page.drawText(c.title, {
    x: 60,
    y: pageH - 80,
    size: 18,
    font,
    color: rgb(0, 0, 0),
  });
  let y = pageH - 130;
  for (const line of c.body) {
    page.drawText(line, { x: 60, y, size: 12, font, color: rgb(0.15, 0.15, 0.15) });
    y -= 24;
  }
  // 签名栏
  y -= 40;
  page.drawText('甲方（盖章）：____________________', { x: 60, y, size: 12, font, color: rgb(0.1, 0.1, 0.1) });
  page.drawText('乙方（盖章）：____________________', { x: 300, y, size: 12, font, color: rgb(0.1, 0.1, 0.1) });
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, await doc.save());
console.log(`测试 PDF 已生成: ${OUT}（${contents.length} 页）`);
