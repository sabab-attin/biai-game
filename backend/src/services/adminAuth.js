import bcrypt from 'bcryptjs';
import { Admin } from '../models/Admin.js';
import { createAdminToken, verifyAdminToken } from './token.js';

export const ADMIN_COOKIE = 'biai_admin';
export const ADMIN_COOKIE_MAX_AGE_MS = 1000 * 60 * 60 * 8;

// Valid bcrypt hash used to keep failed-login timing consistent for unknown usernames.
const DUMMY_HASH = '$2b$10$EfpK.AkSFvKkj4dugfZA2uF7agT9IDADN4rGu9/BIfafsqzAyn8S6';

export function parseCookies(header = '') {
  const cookies = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index <= 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!key) continue;
    try {
      cookies[key] = decodeURIComponent(value);
    } catch {
      cookies[key] = value;
    }
  }
  return cookies;
}

export function adminNotFound(res) {
  return res.status(404).type('text/plain').send('Not Found');
}

export function setAdminCookie(res, token, config) {
  res.cookie(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'none',
    secure: true,
    maxAge: ADMIN_COOKIE_MAX_AGE_MS,
    path: '/',
  });
}

export function clearAdminCookie(res) {
  res.clearCookie(ADMIN_COOKIE, { path: '/', sameSite: 'none', secure: true });
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password, passwordHash) {
  if (!password || !passwordHash) return false;
  return bcrypt.compare(password, passwordHash);
}

export async function ensureAdminSeed(config, logger = console) {
  const usernames = Array.isArray(config.adminUsernames)
    ? config.adminUsernames
    : [];
  const hasHash = Boolean(config.adminPasswordHash);
  const hasPassword = Boolean(config.adminPassword);

  if (!usernames.length || (!hasHash && !hasPassword)) {
    logger.warn(
      '[admin] No admin seeded. Set ADMIN_USERNAMES and ADMIN_PASSWORD (or ADMIN_PASSWORD_HASH).'
    );
    return null;
  }

  const passwordHash = hasHash ? config.adminPasswordHash : await hashPassword(config.adminPassword);
  const seeded = [];

  for (const username of usernames) {
    const existing = await Admin.findOne({ username });
    if (existing) {
      seeded.push(existing);
      continue;
    }

    const admin = await Admin.create({ username, passwordHash, role: 'admin' });
    logger.log(`[admin] Seeded admin account "${username}".`);
    seeded.push(admin);
  }

  const removed = await Admin.deleteMany({ username: { $nin: usernames } });
  if (removed.deletedCount) {
    logger.log(
      `[admin] Removed ${removed.deletedCount} admin account(s) not listed in ADMIN_USERNAMES.`
    );
  }

  return seeded;
}

export function requireAdmin(config) {
  return async function adminGuard(req, res, next) {
    try {
      const cookies = parseCookies(req.headers.cookie || '');
      const token = cookies[ADMIN_COOKIE];
      const payload = verifyAdminToken(token, config.sessionSecret);
      if (!payload) {
        return adminNotFound(res);
      }

      const admin = await Admin.findById(payload.aid).lean();
      if (!admin || admin.role !== 'admin') {
        return adminNotFound(res);
      }

      req.admin = {
        id: String(admin._id),
        username: admin.username,
        role: admin.role,
      };
      return next();
    } catch (error) {
      console.error('[admin] Auth check failed:', error);
      return adminNotFound(res);
    }
  };
}

export async function authenticateAdmin(username, password) {
  const cleanUsername = String(username || '').trim().toLowerCase();
  if (!cleanUsername || !password) {
    return null;
  }

  const admin = await Admin.findOne({ username: cleanUsername });
  if (!admin) {
    await bcrypt.compare(String(password), DUMMY_HASH).catch(() => {});
    return null;
  }

  const valid = await verifyPassword(String(password), admin.passwordHash);
  if (!valid) return null;

  admin.lastLoginAt = new Date();
  await admin.save();
  return admin;
}

export function issueAdminToken(admin, config) {
  return createAdminToken(admin._id, admin.role, config.sessionSecret);
}
