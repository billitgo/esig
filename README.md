# 电子盖章系统（seal-system）

网页版电子章盖章工具：上传 PDF + PNG 电子章，在线预览，单击盖章，支持骑缝章，无水印导出。

## 功能

- 上传 PDF 文件（多页）与 PNG 电子章（透明底）
- 在线预览（pdf.js 渲染，分页导航）
- 预览页**鼠标左键单击 = 加盖一枚电子章**（所见即所得，可拖动/缩放调整，Delete 删除）
- 印章尺寸预设：标准 42mm / 小 21mm；透明度可调
- **骑缝章**：按页数等分切片、逐页贴到右边缘，垂直拖动调整位置
- 导出盖章后 PDF（pdf-lib 无损嵌入，不栅格化原 PDF）
- 全程浏览器本地处理，文件不上传服务器

## 架构（前后端分离）

```
seal-system/
├── frontend/                 # 前端：Vite + Vue3 + pdf.js + fabric.js + pdf-lib
│   ├── src/
│   │   ├── api/              # API 客户端（已预留 JWT 鉴权拦截器）
│   │   ├── utils/            # pdfRenderer（渲染）/ sealSlice（骑缝章切片）/ stampExport（导出）
│   │   └── components/       # PdfViewer（预览+盖章画布）
│   └── vite.config.js        # dev 时 /api 代理到后端
└── backend/                  # 后端：Node.js + Express（骨架，为权限管理预留）
    └── src/
        ├── middleware/auth.js      # 鉴权中间件（占位，二期接入 JWT）
        └── routes/                 # auth（登录）/ seals（印章库）/ stamp-records（盖章记录）占位路由
```

### 权限管理预留（二期）

| 模块 | 现状 | 二期规划 |
|---|---|---|
| `/api/auth` | 501 占位 | 登录/登出/当前用户，签发 JWT |
| `/api/seals` | 返回空列表 | 印章统一存储、按角色授权使用 |
| `/api/stamp-records` | 返回空列表 | 盖章操作审计日志 |
| 前端 `api/index.js` | 已留拦截器注入点 | 自动携带 `Authorization: Bearer <token>` |

## 本地运行

环境要求：Node.js ≥ 18

```bash
# 1. 启动后端（端口 3000）
cd backend
npm install
npm run dev

# 2. 启动前端（端口 5173，已代理 /api 到后端）
cd frontend
npm install
npm run dev
```

浏览器打开 http://localhost:5173

### 生产部署（建议）

```bash
cd frontend && npm run build   # 产物在 frontend/dist
```
将 dist 静态文件交由 Nginx 托管，`/api` 反向代理到后端服务（如 `http://127.0.0.1:3000`）。

## 开源致谢

- 盖章核心实现参考 [bfritscher/pdf-stamp](https://github.com/bfritscher/pdf-stamp)（MIT License）：pdf.js 渲染 + fabric.js 交互 + pdf-lib 无损导出、坐标换算方案
- 依赖库：[pdf.js](https://github.com/mozilla/pdf.js)、[fabric.js](https://github.com/fabricjs/fabric.js)、[pdf-lib](https://github.com/Hopding/pdf-lib)
- 功能交互参考：[小印章 esign.freecicoda.com/pdfPanel](https://esign.freecicoda.com/pdfPanel)（界面参考，无代码复用）
