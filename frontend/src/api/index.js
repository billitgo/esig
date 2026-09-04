/**
 * 后端 API 客户端
 *
 * 前后端分离架构下的统一请求入口。
 * 为权限管理预留：请求拦截器已写好注入点，后续登录体系上线后，
 * 只需在 `getAuthToken()` 中返回 localStorage 里的 JWT，即可自动携带凭证。
 */
const BASE_URL = '/api';

export function getAuthToken() {
  // TODO(权限二期): 返回 localStorage 中保存的 JWT，例如 localStorage.getItem('seal_token')
  return null;
}

export async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    // TODO(权限二期): 触发登录跳转
    console.warn('[api] 未授权（401），请接入登录流程');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `请求失败: ${res.status}`);
  }
  return data;
}

/** 健康检查：验证前后端连通性 */
export function checkHealth() {
  return request('/health');
}

/** 预留：登录 */
export function login(payload) {
  return request('/auth/login', { method: 'POST', body: JSON.stringify(payload) });
}

/** 预留：获取印章库列表 */
export function fetchSeals() {
  return request('/seals');
}

/** 预留：上报盖章记录 */
export function reportStampRecord(payload) {
  return request('/stamp-records', { method: 'POST', body: JSON.stringify(payload) });
}
