const API_HOST = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const API_BASE = `${API_HOST}/api`;

const TOKEN_KEY = 'biai_admin_token';

export function saveAdminToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
}

export function clearAdminToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function getAdminToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

async function request(path, options = {}) {
  const token = getAdminToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
  }).then((data) => {
    if (data?.token) saveAdminToken(data.token);
    return data;
  });
}

export function fetchAdminSession() {
  return request('/admin/session');
}

export function logoutAdmin() {
  clearAdminToken();
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
  const token = getAdminToken();
  const res = await fetch(`${API_BASE}/admin/csv/download`, {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
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

export function fetchAdminPhotos({ limit = 150 } = {}) {
  return request(`/admin/photos?limit=${encodeURIComponent(String(limit))}`);
}

export function getAdminPhotoImageUrl(photoId, { download = false } = {}) {
  const query = download ? '?download=1' : '';
  return `${API_BASE}/admin/photos/${encodeURIComponent(photoId)}/image${query}`;
}

export async function fetchAdminPhotoBlobUrl(photoId) {
  const token = getAdminToken();
  const res = await fetch(getAdminPhotoImageUrl(photoId), {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const error = new Error(`Could not load photo (${res.status}).`);
    error.status = res.status;
    throw error;
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function downloadAdminPhoto(photo) {
  const token = getAdminToken();
  const url = getAdminPhotoImageUrl(photo.photoId, { download: true });
  const res = await fetch(url, {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const error = new Error(`Could not download photo (${res.status}).`);
    error.status = res.status;
    throw error;
  }
  const blob = await res.blob();
  const ext =
    photo.mimeType === 'image/webp' ? 'webp' : photo.mimeType === 'image/png' ? 'png' : 'jpg';
  const safeName =
    String(photo.winnerName || 'winner')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'winner';
  return { blob, filename: `biai-${safeName}.${ext}` };
}

export function deleteAdminPhoto(photoId) {
  return request(`/admin/photos/${encodeURIComponent(photoId)}`, {
    method: 'DELETE',
  });
}

export function fetchWheelOdds() {
  return request('/admin/wheel-odds');
}

export function updateWheelOdds(weights) {
  return request('/admin/wheel-odds', {
    method: 'PUT',
    body: JSON.stringify({ weights }),
  });
}

export function resetWheelOdds() {
  return request('/admin/wheel-odds/reset', {
    method: 'POST',
  });
}

export function fetchQuizSettings() {
  return request('/admin/quiz-settings');
}

export function updateQuizSettings(payload) {
  return request('/admin/quiz-settings', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function resetQuizSettings() {
  return request('/admin/quiz-settings/reset', {
    method: 'POST',
  });
}
