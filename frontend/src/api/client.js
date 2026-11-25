const API_BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'same-origin',
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

export function enterPlayer(data) {
  return request('/players/enter', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function enterAsGuest() {
  return request('/players/guest', {
    method: 'POST',
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

export function startQuiz(token) {
  return request('/quiz/start', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function answerQuiz(token, payload) {
  return request('/quiz/answer', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export function finishQuiz(token, payload) {
  return request('/quiz/finish', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}
