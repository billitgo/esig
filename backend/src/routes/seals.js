import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';

const router = Router();

/**
 * 印章库管理（占位实现）
 * 后续接入：印章 PNG 上传存储、印章列表、印章启停、按角色授权使用范围。
 * 当前阶段印章由前端本地管理，后端接口先返回空列表保持契约稳定。
 */

// 印章列表（受保护）
router.get('/', authMiddleware, (req, res) => {
  res.json({ data: [], total: 0 });
});

// 上传印章（占位，管理员）
router.post('/', authMiddleware, requireRole('admin'), (req, res) => {
  res.status(501).json({
    code: 'NOT_IMPLEMENTED',
    message: '印章上传接口为占位实现，后续由后端统一存储与管理',
  });
});

// 删除印章（占位，管理员）
router.delete('/:id', authMiddleware, requireRole('admin'), (req, res) => {
  res.status(501).json({
    code: 'NOT_IMPLEMENTED',
    message: '印章删除接口为占位实现',
  });
});

export default router;
