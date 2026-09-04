import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth.js';
import sealRoutes from './routes/seals.js';
import stampRecordRoutes from './routes/stampRecords.js';

/**
 * 应用主装配文件
 * 架构说明：
 *  - 前后端分离：前端（Vite+Vue3）负责 PDF 渲染/盖章/导出，后端仅提供服务化接口
 *  - 为后续权限管理预留：
 *      1. /api/auth        认证模块（登录/登出/当前用户），当前为占位实现
 *      2. /api/seals       印章库管理（当前为占位实现）
 *      3. /api/stamp-records 盖章操作审计记录（当前为占位实现）
 *  - authMiddleware 已挂载到受保护路由，后续接入 JWT 即可生效
 */
export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true }));

  // 健康检查
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'seal-system-backend',
      version: '0.1.0',
      time: new Date().toISOString(),
    });
  });

  // 预留模块路由
  app.use('/api/auth', authRoutes);
  app.use('/api/seals', sealRoutes);
  app.use('/api/stamp-records', stampRecordRoutes);

  // 统一 404
  app.use((req, res) => {
    res.status(404).json({ code: 'NOT_FOUND', message: `接口不存在: ${req.method} ${req.path}` });
  });

  // 统一错误处理
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error('[backend error]', err);
    res.status(err.status || 500).json({ code: err.code || 'INTERNAL_ERROR', message: err.message || '服务器内部错误' });
  });

  return app;
}
