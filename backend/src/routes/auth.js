import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

/**
 * 认证模块（占位实现）
 * 后续接入：本地账号密码 / 企业 SSO / 微信扫码等，并签发 JWT。
 */

// 登录（占位）
router.post('/login', authMiddleware, (req, res) => {
  res.status(501).json({
    code: 'NOT_IMPLEMENTED',
    message: '登录接口为占位实现，权限管理二期接入',
  });
});

// 登出（占位）
router.post('/logout', authMiddleware, (req, res) => {
  res.status(501).json({
    code: 'NOT_IMPLEMENTED',
    message: '登出接口为占位实现，权限管理二期接入',
  });
});

// 当前登录用户信息（占位）
router.get('/me', authMiddleware, (req, res) => {
  res.status(501).json({
    code: 'NOT_IMPLEMENTED',
    message: '当前用户接口为占位实现，权限管理二期接入',
  });
});

export default router;
