import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

/**
 * 盖章操作记录（占位实现）
 * 后续接入：每次盖章/导出落审计日志（操作人、时间、文件、印章、页数、位置），
 * 满足企业内部合规审计要求。当前阶段前端本地操作，先返回空列表。
 */

// 记录列表（受保护）
router.get('/', authMiddleware, (req, res) => {
  res.json({ data: [], total: 0 });
});

// 新增记录（占位）
router.post('/', authMiddleware, (req, res) => {
  res.status(501).json({
    code: 'NOT_IMPLEMENTED',
    message: '盖章记录上报接口为占位实现',
  });
});

export default router;
