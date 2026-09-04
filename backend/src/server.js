import { createApp } from './app.js';

const PORT = process.env.PORT || 3000;

const app = createApp();

app.listen(PORT, () => {
  console.log(`[seal-system] 后端服务已启动: http://localhost:${PORT}`);
  console.log(`[seal-system] 健康检查: http://localhost:${PORT}/api/health`);
});
