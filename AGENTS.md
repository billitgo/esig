# AGENTS.md — 项目记忆（seal-system 电子盖章系统）

## 项目一句话
网页版 PDF 盖章工具：上传 PDF + PNG 电子章 → 在线预览 → 鼠标跟随/单击盖章 → 骑缝章（贴右边缘切片）→ pdf-lib 无损导出。前后端分离，权限管理二期预留。

## 快速开始
- **一键启动**：双击项目根 `start.bat`（同时拉起后端 3000 + 前端 5173 两个窗口）
- 后端：`cd backend && npm install && npm start`（端口 3000，/api/health 健康检查）
- 前端：`cd frontend && npm install && npm run dev`（端口 5173，dev 已代理 /api→3000）
- 测试素材：`frontend/assets/test-contract.pdf`（3页中文合同）、`test-seal.png`（程序生成测试章）
- 素材再生成：`cd frontend && node scripts/generate-test-pdf.mjs` / `node scripts/generate-test-seal.mjs`

## 局域网访问（已配置，2026-09-07）
- vite.config.js：`server.host:'0.0.0.0'`（监听所有网卡）；backend server.js：`app.listen(PORT,'0.0.0.0')`；均已提交 bde8ef9 并生效（netstat 确认 0.0.0.0 LISTENING）
- **访问地址：http://192.168.2.170:5173**（本机真实局域网 IP；169.254.x / 192.168.85.1 / 192.168.161.1 是虚拟网卡勿用）
- **待办：防火墙放行未完成**（需管理员权限，用户尚未执行）。命令（管理员 PowerShell）：
  `netsh advfirewall firewall add rule name="seal-system-frontend-5173" dir=in action=allow protocol=TCP localport=5173`
  `netsh advfirewall firewall add rule name="seal-system-backend-3000" dir=in action=allow protocol=TCP localport=3000`
- 其他终端无法访问时排查：同网段 ping 192.168.2.170；路由器 AP 隔离

## 架构
- `frontend/`：Vite + Vue3（Composition API）+ pdfjs-dist 4.2.67 + fabric 5.5 + pdf-lib 1.17
  - `src/components/PdfViewer.vue`：PDF 预览 + fabric 画布。核心交互：幽灵章（半透明跟随鼠标）→ 单击或**按空格键**（在**真实光标位置**，window 级 mousemove 记录屏幕坐标 + getPointer 换算，非 fabric 事件）落章；印章拖动/缩放**拖动中不 emit**（避免 watch→renderPage 重建中断拖动），mouseup 才提交，重建后按 `stampId` 恢复选中；骑缝章对象（锁水平、可垂直拖动调 offsetY）；Delete 删除。**注意：落章/拖动结束的 emit 会触发 renderPage 重建，任何交互状态（如选中）须在 renderPage 内恢复**
  - `src/utils/pdfRenderer.js`（渲染）/ `sealSlice.js`（骑缝章切片）/ `stampExport.js`（pdf-lib 导出）
  - `src/api/index.js`：API 客户端，`getAuthToken()` 已留 JWT 注入点，401 自动触发登录跳转占位
  - `vite.config.js`：**必须** `target:'esnext'` + `optimizeDeps.exclude:['pdfjs-dist']`
- `backend/`：Express 骨架（ESM，"type":"module"）
  - `src/middleware/auth.js`：authMiddleware（占位放行）/ requireRole（占位）
  - `src/routes/`：auth（501 占位）、seals（空列表）、stamp-records（空列表）
- `reference/pdf-stamp/`：开源参考项目（MIT，坐标换算方案来源，未直接引入代码）

## 关键坑（都已解决，勿重踩）
1. **pdf.js v4 对象 + Vue3**：pdfDoc 含私有字段（#pagePromises），放入 ref/reactive 会被 Proxy 包裹 → getPage 报 "Cannot read private member"。**必须 `markRaw(doc)`**
2. **ArrayBuffer 被 transfer**：`getDocument({data})` 会 detach 传入的 buffer → 预览传 `buf.slice(0)`，导出保留原始 `buf`
3. **Vite + pdfjs v4**：Top-level await 需 `target:'esnext'`；预构建会破坏内部类 → `optimizeDeps.exclude`
4. **fabric 离屏优化**：对象在画布外（负坐标）创建会被跳过渲染且永不显示 → 幽灵章初始在画布内 + `visible:false`，mouse:move 时显示并跟随
5. **骑缝章**：印章图按页数 N **横向等分 N 片（竖条）**（sliceW=width/N、sliceH=全高），第 i 页右边缘贴第 i 片（渲染宽 = widthPt/N、高 = sealHeight×(widthPt/sealWidth)），装订后拼成完整章。**必须紧贴右边缘 `x = pageWidth - sliceDrawW`（无 margin）**，预览与导出一致。切片在 `sealSlice.js#sliceSealImage`，尺寸在 `calcCrossPageSize`（预览 PdfViewer.vue#renderCrossPagePreview、导出 stampExport.js 共用同一套 scale 算法）
6. **坐标换算**：预览 scale=1 时 1px=1pt；导出 `pdfY = pageHeight - y - height`（fabric y 向下，pdf y 向上）；旋转用 pushGraphicsState + concatTransformationMatrix 绕左下角
7. **pdf-lib 中文字体**：嵌入自定义字体需 `doc.registerFontkit(fontkit)`（**实例方法**，非静态）+ `@pdf-lib/fontkit`；测试 PDF 用 `C:/Windows/Fonts/simhei.ttf` + `{subset:true}`
8. **浏览器自动化（computer_use_tool）**：`bu.click_xy`/`bu.drag`/`bu.press_key` 走真实浏览器命中路径，验证"真实用户操作"必须用它们；`dispatchEvent(MouseEvent)` 直接派发到元素会绕过 DOM 命中，可能掩盖层级类 bug。fabric 5.5.2 默认监听 **mouse 事件**（无 pointer events），事件绑定在 upper-canvas 上
9. **fabric 画布层级（踩过大坑）**：fabric 动态创建 upper-canvas（交互层），它没有 Vue scoped 的 data-v 属性，scoped 样式 `.stamp-canvas[data-v-x]{z-index:2}` 只命中模板里的 lower-canvas → lower(z:2) 盖住 upper(z:auto)，真实鼠标事件被 lower 拦截，fabric 收不到 → 表现为"印章点不中、拖不动、删除无反应"。**修复：全局样式 `.upper-canvas{z-index:3!important}`（styles.css）**，层级 pdf<lower<upper
10. **HMR 会重置 Vue 组件状态，验证导出须刷新后完整重跑**
11. **分支切换教训**：切到 main 后忘切回 feature/stamp-records，导致本地页面跑基线代码（用户发现"没盖章记录"）。切分支后必须确认 `git branch --show-current`

## 二期规划（权限管理）
- `/api/auth` 登录签发 JWT（jsonwebtoken）；`/api/seals` 印章库存储/角色授权；`/api/stamp-records` 盖章审计日志
- 前端：`getAuthToken()` 返回 localStorage token 即自动携带；401 跳登录
- 生产：`cd frontend && npm run build` → Nginx 托管 dist + `/api` 反代 3000

## 交付物状态
- **普通盖章功能已全部验收通过**（用户确认）：上传/预览/幽灵章跟随/单击落章/空格落章（真实光标位置）/真实鼠标点选/拖动/Delete 删除；**缩放已按用户要求取消**（createStampObject 设置 lockScalingX/Y/UniScaling，印章尺寸仅由左侧面板 42mm/21mm 控制）
- **骑缝章功能已验收通过**（用户确认，2026-09-04 两轮调整后）：横向切片（按宽度等分 N 片竖条）、紧贴每页右边缘（无 margin）、默认宽 100pt、**默认 offsetY=199.06（80 + 一个标准章位 119.06）**、可垂直拖动微调；预览与导出像素级验证通过
- **盖章记录列表已上线**（2026-09-04，feature/stamp-records 分支）：左侧面板"盖章记录: 共(N条)记录"区块（在骑缝章区块之前），每条=页码+盖章时间(yyyy-MM-dd HH:mm:ss)+红色删除按钮（删除同步移除印章）；数据来源 stampAt 新增的 `createdAt` 字段（仅加字段，未改盖章/骑缝章行为）；删除走 App.vue#deleteRecord(id)
- **README 已完善**（ed3bc0b）：架构/功能/使用/部署(Nginx)/11条排障表/分支说明/开源致谢
- **一键启动脚本** start.bat（d354394）：双击同时拉起前后端
- **局域网访问**已配置（bde8ef9）：0.0.0.0 监听，防火墙放行待用户管理员执行（见"局域网访问"节）
- **git 已推送 GitHub**（https://github.com/billitgo/esig）：remote origin 已配；main=基线+远程LICENSE合并(32f4287)，feature/stamp-records=盖章记录+README+启动脚本+局域网配置（最新 bde8ef9，**当前工作分支**；切分支后必须切回，否则本地页面跑旧代码）
- 用户浏览器环境下载会被自动化拦截，导出逻辑本身正常（此前像素级验证通过）
- 当前服务以 `npm start` / `npm run dev` 后台运行于 3000/5173（监听 0.0.0.0）
