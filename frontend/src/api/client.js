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

export function spinWheel() {
  return request('/play/wheel/spin', {
    method: 'POST',
  });
}

export function startQuiz() {
  return request('/play/quiz/start', {
    method: 'POST',
  });
}

export function answerQuiz(payload) {
  return request('/play/quiz/answer', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function finishQuiz(payload) {
  return request('/play/quiz/finish', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function claimPlay(payload) {
  return request('/play/claim', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
