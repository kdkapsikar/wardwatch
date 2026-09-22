import { translateServerMessage } from '../i18n/index.js';
import { API_URL } from '../lib/config.js';

const TOKEN_KEY = 'ww_token';

// Session token from login, sent as `Authorization: Bearer`. localStorage can be unavailable (private
// mode, blocked storage), so every access is guarded and the app then just behaves as signed-out.
export const tokenStore = {
  get() {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set(token) {
    try { localStorage.setItem(TOKEN_KEY, token); } catch { /* ignore */ }
  },
  clear() {
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
  },
};

// The API speaks English; messages are translated to the current language when the error is created.
export class ApiError extends Error {
  constructor(status, message, fields) {
    super(translateServerMessage(message));
    this.status = status;
    this.fields = Object.fromEntries(Object.entries(fields ?? {}).map(([k, v]) => [k, translateServerMessage(v)]));
  }
}

async function request(path, { method = 'GET', json, form } = {}) {
  const init = { method, headers: {} };
  const token = tokenStore.get();
  if (token) init.headers.Authorization = `Bearer ${token}`;
  if (json !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(json);
  } else if (form) {
    init.body = form; // the browser sets the multipart boundary itself
  }

  let res;
  try {
    res = await fetch(`${API_URL}/api${path}`, init);
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.');
  }

  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, data?.error?.message ?? 'Something went wrong. Please try again.', data?.error?.fields);
  }
  return data;
}

export const api = {
  // public
  getWards: () => request('/wards'),
  submitIssue: (form) => request('/issues', { method: 'POST', form }),
  trackIssue: (id) => request(`/issues/${encodeURIComponent(id)}`),
  // auth
  me: () => request('/auth/me'),
  login: async (credentials) => {
    const data = await request('/auth/login', { method: 'POST', json: credentials });
    tokenStore.set(data.token);
    return data;
  },
  logout: async () => {
    try {
      await request('/auth/logout', { method: 'POST' });
    } finally {
      tokenStore.clear();
    }
  },
  // citizen (OTP sign-in)
  requestOtp: (phone) => request('/citizen/otp/request', { method: 'POST', json: { phone } }),
  verifyOtp: async (phone, code) => {
    const data = await request('/citizen/otp/verify', { method: 'POST', json: { phone, code } });
    tokenStore.set(data.token);
    return data;
  },
  listMyIssues: () => request('/citizen/issues'),
  getMyIssue: (id) => request(`/citizen/issues/${encodeURIComponent(id)}`),
  // corporator
  getCorporatorDashboard: () => request('/corporator/dashboard'),
  listAssigned: ({ status, page, category, overdue }) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (category) params.set('category', category);
    if (overdue) params.set('overdue', '1');
    if (page > 1) params.set('page', String(page));
    return request(`/corporator/issues?${params}`);
  },
  getTransferTargets: () => request('/corporator/transfer-targets'),
  transferIssue: (id, body) => request(`/corporator/issues/${encodeURIComponent(id)}/transfer`, { method: 'POST', json: body }),
  getAssigned: (id) => request(`/corporator/issues/${encodeURIComponent(id)}`),
  postUpdate: (id, form) => request(`/corporator/issues/${encodeURIComponent(id)}/updates`, { method: 'POST', form }),
  // admin
  getDashboard: () => request('/admin/dashboard'),
  getAdminIssues: ({ status, page, category, overdue, ward }) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (category) params.set('category', category);
    if (ward) params.set('ward', String(ward));
    if (overdue) params.set('overdue', '1');
    if (page > 1) params.set('page', String(page));
    return request(`/admin/issues?${params}`);
  },
  getAdminIssue: (id) => request(`/admin/issues/${encodeURIComponent(id)}`),
  // private notes (each admin only ever sees their own)
  listNotes: (issue) => request(`/admin/notes${issue ? `?issue=${encodeURIComponent(issue)}` : ''}`),
  createNote: (body) => request('/admin/notes', { method: 'POST', json: body }),
  updateNote: (id, body) => request(`/admin/notes/${id}`, { method: 'PUT', json: body }),
  deleteNote: (id) => request(`/admin/notes/${id}`, { method: 'DELETE' }),
};
