const BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

export function setToken(token) {
  if (token) localStorage.setItem('token', token);
  else localStorage.removeItem('token');
}

function authHeaders(extra = {}) {
  const headers = { 'Content-Type': 'application/json', ...extra };
  const token = getToken();
  if (token) headers['x-auth-token'] = token;
  return headers;
}

async function request(path, options = {}) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const response = await fetch(`${BASE}${normalizedPath}`, {
    ...options,
    headers: { ...authHeaders(), ...options.headers }
  });

  let data = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await response.json().catch(() => ({}));
  }

  if (!response.ok) {
    const err = new Error(data?.msg || data?.message || `Request failed (${response.status})`);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: (path) => request(path, { method: 'DELETE' }),
  getToken,
  setToken
};
