# 电子盖章系统（seal-system）

网页版电子章盖章工具：上传 PDF 与 PNG 电子章 → 在线预览 → 单击/空格盖章 → 骑缝章 → 无损导出。前后端分离架构，为权限管理（二期）预留。

仓库地址：`https://github.com/billitgo/esig`

## 功能特性

- **PDF 上传**：多页 PDF 在线渲染预览（pdf.js），分页导航
- **PNG 电子章上传**：透明底 PNG，印章尺寸预设（标准 42mm / 小 21mm），透明度可调
- **智能盖章**：
  - 半透明"幽灵章"跟随鼠标实时预览盖章位置
  - **鼠标左键单击** 或 **按空格键**（真实光标位置）各盖一枚章
  - 印章可点选、拖动调整位置、Delete 或按钮删除（缩放已按需求取消）
- **骑缝章**：印章横向等分 N 片（竖条），紧贴每页右边缘（接缝处），装订后拼成完整印章；可垂直拖动调整位置，宽度可调
- **盖章记录列表**：记录每枚章（页码 + 盖章时间 + 删除），可滚动
- **无损导出**：pdf-lib 嵌入印章，不栅格化原 PDF，导出"原文件-盖章.pdf"
- 全程浏览器本地处理，文档不上传服务器

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vite 5 + Vue 3（Composition API）+ pdfjs-dist 4.2.67 + fabric.js 5.5.2 + pdf-lib 1.17 |
| 后端 | Node.js + Express（骨架，权限二期预留） |
| 参考实现 | [bfritscher/pdf-stamp](https://github.com/bfritscher/pdf-stamp)（MIT）— 渲染/交互/导出坐标换算方案 |

> 版本锁定说明：`pdfjs-dist` 必须固定 4.2.67（v4 行为）；`pdf-lib` 嵌入中文字体需 `@pdf-lib/fontkit`。

## 项目架构

```
seal-system/
├── frontend/                          # 前端（Vite + Vue3）
│   ├── src/
│   │   ├── api/index.js               # API 客户端（已预留 JWT 注入点）
│   │   ├── utils/
│   │   │   ├── pdfRenderer.js         # pdf.js 页面渲染
│   │   │   ├── sealSlice.js           # 骑缝章切片（横向等分）
│   │   │   └── stampExport.js         # pdf-lib 无损导出（预览与导出一致）
│   │   ├── components/
│   │   │   └── PdfViewer.vue          # 预览 + fabric 盖章画布（核心交互）
│   │   ├── App.vue                    # 侧边栏 + 状态管理 + 盖章记录
│   │   └── styles.css                 # 全局样式（含 fabric 画布层级修复）
│   ├── assets/                        # 测试素材（test-contract.pdf / test-seal.png）
│   ├── scripts/                       # 测试素材生成脚本
│   └── vite.config.js                 # dev 代理 /api → 3000
├── backend/                           # 后端（Express 骨架）
│   └── src/
│       ├── middleware/auth.js         # 鉴权中间件（占位，二期接 JWT）
│       ├── routes/                    # auth / seals / stamp-records 占位路由
│       └── server.js                  # 端口 3000
├── reference/pdf-stamp/               # 开源参考克隆（MIT）
└── AGENTS.md                          # 项目记忆（关键技术决策与坑）
```

### 核心交互链路

```
上传 PDF/印章 → pdf.js 渲染页面 → fabric 画布叠加
  ├─ mouse:move  → 幽灵章半透明跟随（记录光标位置）
  ├─ mouse:down / 空格 → stampAt() 落章（记录 createdAt）
  ├─ 选中拖动 → moving 中只更新内存，mouseup 提交
  └─ 导出 → stampExport.js 按同一坐标换算写回 PDF
```

### 权限管理预留（二期）

| 模块 | 现状 | 二期规划 |
|---|---|---|
| `/api/auth` | 501 占位 | 登录/登出，签发 JWT |
| `/api/seals` | 返回空列表 | 印章库存储、按角色授权 |
| `/api/stamp-records` | 返回空列表 | 盖章操作审计日志 |
| 前端 `api/index.js` | 已留拦截器注入点 | 自动携带 `Authorization: Bearer <token>` |

## 使用方法

### 环境要求

- Node.js ≥ 18（建议 18/20 LTS）
- Windows / macOS / Linux 均可

### 本地运行

```bash
# 1. 启动后端（端口 3000）
cd backend
npm install
npm start

# 2. 启动前端（端口 5173）
cd frontend
npm install
npm run dev
```

浏览器打开 **http://localhost:5173**。

### 操作步骤

1. **上传 PDF**：左侧面板 → "1. 上传 PDF 文件"
2. **上传印章**："2. 上传电子印章（PNG）"，可选标准/小尺寸、调透明度
3. **盖章**：移动鼠标看半透明预览 → 单击或按空格在光标处盖章；点选印章可拖动，Delete 删除
4. **骑缝章**："3. 骑缝章"开启 → 右边缘出现切片，垂直拖动微调，滑块调宽度
5. **导出**："4. 导出" → 下载"原文件-盖章.pdf"
6. **记录管理**：盖章记录列表随时查看页码/时间，可逐条删除

### 测试素材

- `frontend/assets/test-contract.pdf`（3 页中文合同）、`test-seal.png`（程序生成测试章）
- 重新生成：`cd frontend && node scripts/generate-test-pdf.mjs`、`node scripts/generate-test-seal.mjs`

## 部署方法

### 生产构建 + Nginx

```bash
cd frontend
npm run build        # 产物在 frontend/dist
```

Nginx 配置示例：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态资源
    root /path/to/frontend/dist;
    index index.html;

    # SPA 路由回退
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 反向代理到后端
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

后端生产运行：`cd backend && npm start`（可用 pm2/systemd 守护）。

> 安全提示：后端目前是骨架（无鉴权），**生产公网部署前请先完成二期权限接入**，否则 /api 接口可被任意访问。

## 常见问题排查

| 现象 | 原因 | 解决方法 |
|---|---|---|
| 页面没有"盖章记录"区块 | 工作区切到了旧分支（main 是基线） | `git checkout feature/stamp-records` 后刷新 |
| 印章点不中、拖不动、删除无反应 | fabric 交互层（upper-canvas）被渲染层盖住 | 确认 `styles.css` 有全局 `.upper-canvas { z-index: 3 !important; }`（fabric 动态创建的元素无 Vue scoped 属性，scoped 样式无效） |
| 幽灵章（半透明跟随预览）不显示 | 对象在画布外（负坐标）创建被 fabric 离屏优化跳过 | 初始位置必须在画布内 + `visible: false`，鼠标移入再显示 |
| 上传 PDF 报 "Cannot read private member #pagePromises" | pdf.js v4 对象被 Vue 响应式代理包裹 | `pdfDoc.value = markRaw(doc)` |
| Vite 启动报 "Top-level await is not available" | 构建目标不支持 esnext | `vite.config.js` 设 `target: 'esnext'` 且 `optimizeDeps.exclude: ['pdfjs-dist']` |
| 导出 PDF 中文乱码/缺失 | 嵌入字体失败 | `doc.registerFontkit(fontkit)`（**实例方法**）+ 系统中文字体 + `{ subset: true }` |
| 端口被占用 | 3000/5173 被其他进程占用 | `netstat -ano | findstr :3000` 找到 PID 后结束，或改端口 |
| 浏览器自动下载被拦截 | 自动化环境限制 | 手动浏览器点击"下载盖章 PDF"正常；自动化验证走临时钩子 |
| 盖章记录时间显示"—" | 该章在 createdAt 字段加入前生成 | 重新盖章即可 |

## Git 分支

| 分支 | 说明 |
|---|---|
| `main` | 基线：完整可用版本（无盖章记录） |
| `feature/stamp-records` | 盖章记录列表 + 区块顺序调整（当前工作分支） |

## 开源致谢

- 盖章核心实现参考 [bfritscher/pdf-stamp](https://github.com/bfritscher/pdf-stamp)（MIT License）
- 依赖库：[pdf.js](https://github.com/mozilla/pdf.js)、[fabric.js](https://github.com/fabricjs/fabric.js)、[pdf-lib](https://github.com/Hopding/pdf-lib)
- 功能交互参考：[小印章 esign.freecicoda.com/pdfPanel](https://esign.freecicoda.com/pdfPanel)（界面参考，无代码复用）
