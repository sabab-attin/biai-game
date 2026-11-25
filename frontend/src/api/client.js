const API_BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const payload = isJson ? await res.json() : null;

  if (!res.ok) {
    const error = new Error(payload?.error || `Request failed (${res.status}).`);
    error.status = res.status;
    error.field = payload?.field || null;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export function fetchPrizes() {
  return request('/prizes');
}

export function fetchStats() {
  return request('/stats');
}

export function fetchRecentSpins() {
  return request('/wheel/recent');
}

export function enterPlayer(data) {
  return request('/players/enter', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function fetchCurrentPlayer(token) {
  return request('/players/me', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function spinWheel(token) {
  return request('/wheel/spin', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function fetchAdminEntries(passkey) {
  return request('/admin/entries', {
    headers: {
      'x-admin-key': passkey,
    },
  });
}

export async function downloadAdminCsv(passkey) {
  const res = await fetch(`${API_BASE}/admin/export.csv`, {
    headers: {
      'x-admin-key': passkey,
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || 'Could not download CSV export.');
  }
  return res.blob();
}
