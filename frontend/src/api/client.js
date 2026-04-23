const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

let accessToken = localStorage.getItem('accessToken');
let refreshToken = localStorage.getItem('refreshToken');
let onAuthFail = null;

export function setAuthFailHandler(handler) { onAuthFail = handler; }

export function setTokens(access, refresh) {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem('accessToken', access);
  localStorage.setItem('refreshToken', refresh);
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

async function tryRefresh() {
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch { return false; }
}

export async function api(path, options = {}) {
  const url = `${API_URL}${path}`;
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  let res = await fetch(url, { ...options, headers });

  if (res.status === 401 && refreshToken) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${accessToken}`;
      res = await fetch(url, { ...options, headers });
    } else {
      clearTokens();
      if (onAuthFail) onAuthFail();
      throw new Error('Session expired');
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// Auth
export const authApi = {
  login: (email, password) => api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (email, password, name, role) => api('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name, role }) }),
  logout: () => api('/api/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }),
  me: () => api('/api/auth/me'),
};

// Projects
export const projectApi = {
  list: () => api('/api/projects'),
  get: (id) => api(`/api/projects/${id}`),
  create: (data) => api('/api/projects', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => api(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => api(`/api/projects/${id}`, { method: 'DELETE' }),
};

// Tasks
export const taskApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api(`/api/tasks?${qs}`);
  },
  get: (id) => api(`/api/tasks/${id}`),
  create: (data) => api('/api/tasks', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => api(`/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => api(`/api/tasks/${id}`, { method: 'DELETE' }),
  dependencyGraph: (projectId) => api(`/api/tasks/graph/${projectId}`),
  overridePriority: (data) => api('/api/tasks/override-priority', { method: 'POST', body: JSON.stringify(data) }),
  bulkUpdate: (data) => api('/api/tasks/bulk/update', { method: 'PUT', body: JSON.stringify(data) }),
};

// Comments
export const commentApi = {
  list: (taskId) => api(`/api/comments/${taskId}/comments`),
  create: (taskId, content) => api(`/api/comments/${taskId}/comments`, { method: 'POST', body: JSON.stringify({ content }) }),
  delete: (taskId, commentId) => api(`/api/comments/${taskId}/comments/${commentId}`, { method: 'DELETE' }),
  activity: (taskId) => api(`/api/comments/${taskId}/activity`),
};

// AI
export const aiApi = {
  prioritize: (projectId) => api('/api/ai/prioritize', { method: 'POST', body: JSON.stringify({ project_id: projectId }) }),
};

// Users
export const userApi = {
  list: (params = {}) => { const qs = new URLSearchParams(params).toString(); return api(`/api/users?${qs}`); },
  get: (id) => api(`/api/users/${id}`),
  create: (data) => api('/api/users', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => api(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  resetPassword: (id, password) => api(`/api/users/${id}/password`, { method: 'PUT', body: JSON.stringify({ password }) }),
  deactivate: (id) => api(`/api/users/${id}`, { method: 'DELETE' }),
  updateProfile: (data) => api('/api/users/profile/me', { method: 'PUT', body: JSON.stringify(data) }),
  changePassword: (data) => api('/api/users/profile/password', { method: 'PUT', body: JSON.stringify(data) }),
};

// Notifications
export const notificationApi = {
  list: () => api('/api/notifications'),
  unreadCount: () => api('/api/notifications/unread-count'),
  markRead: (id) => api(`/api/notifications/${id}/read`, { method: 'PUT' }),
  markAllRead: () => api('/api/notifications/read-all', { method: 'PUT' }),
};

// Analytics
export const analyticsApi = {
  overview: () => api('/api/analytics/overview'),
  teamWorkload: (projectId) => api(`/api/analytics/team-workload${projectId ? `?project_id=${projectId}` : ''}`),
  project: (id) => api(`/api/analytics/project/${id}`),
  myStats: () => api('/api/analytics/my-stats'),
  trends: () => api('/api/analytics/trends'),
  priorityDistribution: () => api('/api/analytics/priority-distribution'),
  userActivity: () => api('/api/analytics/user-activity'),
  myActivity: () => api('/api/analytics/my-activity'),
  projectHealth: () => api('/api/analytics/project-health'),
};

// Audit Log
export const auditApi = {
  list: (params = {}) => { const qs = new URLSearchParams(params).toString(); return api(`/api/audit-log?${qs}`); },
};
