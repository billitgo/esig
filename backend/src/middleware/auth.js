/**
 * 鉴权中间件（占位实现）
 *
 * 后续权限管理接入方案：
 *  1. 安装 jsonwebtoken，登录成功后签发 JWT（如 2h 过期）
 *  2. 前端 axios 拦截器携带 `Authorization: Bearer <token>`
 *  3. 本中间件校验 token，并把用户信息挂到 req.user
 *  4. 需要登录的接口挂载本中间件；需要特定角色的接口再叠加角色校验
 *
 * 当前阶段：统一放行（不拦截），但保留完整骨架，权限上线时只需启用校验逻辑。
 */
export function authMiddleware(req, res, next) {
  // TODO(权限二期): 校验 Authorization header 中的 JWT
  req.user = null;
  next();
}

/**
 * 角色校验中间件（占位）
 * 用法：router.post('/seals', requireRole('admin'), handler)
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    // TODO(权限二期): 校验 req.user.role 是否在 roles 中
    next();
  };
}
