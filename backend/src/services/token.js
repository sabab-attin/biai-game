import crypto from 'node:crypto';

const ADMIN_TOKEN_TTL_MS = 1000 * 60 * 60 * 8;
const QUIZ_TOKEN_TTL_MS = 1000 * 60 * 60 * 2;

function sign(payloadB64, secret) {
  return crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
}

function signPayload(payload, secret) {
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${payloadB64}.${sign(payloadB64, secret)}`;
}

function verifyPayload(token, secret) {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return null;
  }

  const [payloadB64, sig] = token.split('.');
  if (!payloadB64 || !sig) {
    return null;
  }

  const expected = sign(payloadB64, secret);
  const sigBuf = Buffer.from(sig, 'utf8');
  const expBuf = Buffer.from(expected, 'utf8');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!parsed.exp || Date.now() > Number(parsed.exp)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function createAdminToken(adminId, role, secret) {
  return signPayload(
    {
      aid: String(adminId),
      role,
      kind: 'admin',
      exp: Date.now() + ADMIN_TOKEN_TTL_MS,
    },
    secret
  );
}

export function verifyAdminToken(token, secret) {
  const payload = verifyPayload(token, secret);
  if (!payload || payload.kind !== 'admin' || !payload.aid || payload.role !== 'admin') {
    return null;
  }
  return payload;
}

export function createQuizToken({ questionIds, quizId }, secret) {
  return signPayload(
    {
      qids: questionIds,
      quizId,
      kind: 'quiz',
      exp: Date.now() + QUIZ_TOKEN_TTL_MS,
    },
    secret
  );
}

export function verifyQuizToken(token, secret) {
  const payload = verifyPayload(token, secret);
  if (
    !payload ||
    payload.kind !== 'quiz' ||
    !Array.isArray(payload.qids) ||
    !payload.quizId
  ) {
    return null;
  }
  return payload;
}

export function verifyPasskey(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string' || !expected) {
    return false;
  }
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}
