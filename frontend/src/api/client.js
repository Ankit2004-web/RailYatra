const BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

export function setToken(token) {
  if (token) localStorage.setItem('token', token);
  else localStorage.removeItem('token');
}

function createIdempotencyKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
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
    const detail = data?.errors?.map((e) => e.message).filter(Boolean).join(', ');
    const err = new Error(detail || data?.detail || data?.msg || data?.message || `Request failed (${response.status})`);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body, options = {}) => {
    const headers = { ...options.headers };
    if (options.idempotent !== false) {
      headers['Idempotency-Key'] = options.idempotencyKey || createIdempotencyKey();
    }
    return request(path, { method: 'POST', body: JSON.stringify(body), headers });
  },
  put: (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: (path) => request(path, { method: 'DELETE' }),
  getToken,
  setToken
};

export async function pollBookingStatus(bookingId, { maxAttempts = 15, intervalMs = 2000 } = {}) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const status = await api.get(`/bookings/${bookingId}/status`);
    if (status.status === 'Confirmed' || status.paymentStatus === 'Paid') {
      return status;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return null;
}
