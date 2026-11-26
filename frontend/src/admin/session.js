const API_HOST = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const API_BASE = `${API_HOST}/api`;

const ADMIN_TAB_KEY = 'biai_admin_tab';
const ADMIN_SIGNED_IN_KEY = 'biai_admin_signed_in';
const ADMIN_TOKEN_KEY = 'biai_admin_token';

export function markAdminLoggedIn() {
  try {
    sessionStorage.setItem(ADMIN_TAB_KEY, '1');
    localStorage.setItem(ADMIN_SIGNED_IN_KEY, '1');
  } catch {
    // Ignore storage restrictions.
  }
}

export function clearAdminMarkers() {
  try {
    sessionStorage.removeItem(ADMIN_TAB_KEY);
    localStorage.removeItem(ADMIN_SIGNED_IN_KEY);
    localStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    // Ignore storage restrictions.
  }
}

export function hasActiveAdminTab() {
  try {
    return sessionStorage.getItem(ADMIN_TAB_KEY) === '1';
  } catch {
    return false;
  }
}

export function hasSignedInMarker() {
  try {
    return localStorage.getItem(ADMIN_SIGNED_IN_KEY) === '1';
  } catch {
    return false;
  }
}

export function isBackForwardNavigation() {
  try {
    const entry = performance.getEntriesByType?.('navigation')?.[0];
    return entry?.type === 'back_forward';
  } catch {
    return false;
  }
}

export async function logoutAdminKeepalive() {
  let token = '';
  try {
    token = localStorage.getItem(ADMIN_TOKEN_KEY) || '';
  } catch {
    token = '';
  }
  clearAdminMarkers();
  try {
    await fetch(`${API_BASE}/admin/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      keepalive: true,
    });
  } catch {
    // Best-effort cookie cleanup when leaving the admin page.
  }
}
