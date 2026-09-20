export class ApiError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields ?? {};
  }
}

async function request(path, { method = 'GET', json, form } = {}) {
  const init = { method, credentials: 'same-origin', headers: {} };
  if (json !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(json);
  } else if (form) {
    init.body = form; // the browser sets the multipart boundary itself
  }

  let res;
  try {
    res = await fetch(`/api${path}`, init);
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
  login: (credentials) => request('/auth/login', { method: 'POST', json: credentials }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  // corporator
  listAssigned: ({ status, page }) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (page > 1) params.set('page', String(page));
    return request(`/corporator/issues?${params}`);
  },
  getAssigned: (id) => request(`/corporator/issues/${encodeURIComponent(id)}`),
  postUpdate: (id, form) => request(`/corporator/issues/${encodeURIComponent(id)}/updates`, { method: 'POST', form }),
  // admin
  getDashboard: () => request('/admin/dashboard'),
};
