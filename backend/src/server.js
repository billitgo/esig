import { createApp } from './app.js';

const PORT = process.env.PORT || 3000;

const app = createApp();

// 监听 0.0.0.0：允许局域网内其他终端访问后端
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[seal-system] 后端服务已启动: http://localhost:${PORT}`);
  console.log(`[seal-system] 健康检查: http://localhost:${PORT}/api/health`);
});
