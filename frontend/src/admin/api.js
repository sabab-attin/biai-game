const API_HOST = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const API_BASE = `${API_HOST}/api`;

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const contentType = res.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    const error = new Error(
      (payload && typeof payload === 'object' && payload.error) ||
        (typeof payload === 'string' && payload.trim()) ||
        `Request failed (${res.status}).`
    );
    error.status = res.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export function loginAdmin(username, password) {
  return request('/admin-login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function fetchAdminSession() {
  return request('/admin/session');
}

export function logoutAdmin() {
  return request('/admin/logout', { method: 'POST' });
}

export function fetchAdminRecords({ source = '', limit = 200 } = {}) {
  const params = new URLSearchParams();
  if (source) params.set('source', source);
  params.set('limit', String(limit));
  return request(`/admin/records?${params.toString()}`);
}

export function fetchDartRecords() {
  return request('/admin/dart');
}

export function createDartRecord(data) {
  return request('/admin/dart', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateDartRecord(recordId, data) {
  return request(`/admin/dart/${encodeURIComponent(recordId)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteDartRecord(recordId) {
  return request(`/admin/dart/${encodeURIComponent(recordId)}`, {
    method: 'DELETE',
  });
}

export function deleteAdminRecord(recordId) {
  return request(`/admin/records/${encodeURIComponent(recordId)}`, {
    method: 'DELETE',
  });
}

export function fetchAdminCsv() {
  return request('/admin/csv');
}

export function rebuildAdminCsv() {
  return request('/admin/csv/rebuild', { method: 'POST' });
}

export async function downloadAdminCsv() {
  const res = await fetch(`${API_BASE}/admin/csv/download`, {
    credentials: 'same-origin',
  });
  if (!res.ok) {
    const error = new Error(`Could not download CSV (${res.status}).`);
    error.status = res.status;
    throw error;
  }
  return res.blob();
}

export function importRecordsCsv(csv) {
  return request('/admin/import', {
    method: 'POST',
    headers: { 'Content-Type': 'text/csv' },
    body: csv,
  });
}

export function fetchAuditLog() {
  return request('/admin/audit');
}
