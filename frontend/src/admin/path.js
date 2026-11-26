const rawPath = import.meta.env.VITE_ADMIN_PATH || 'admin';

export const ADMIN_HASH_BASE = `#${rawPath.replace(/^#/, '')}`;
export const ADMIN_LOGIN_HASH = `${ADMIN_HASH_BASE}/login`;

export function isAdminHash(hash) {
  return hash === ADMIN_HASH_BASE || hash.startsWith(`${ADMIN_HASH_BASE}/`);
}
