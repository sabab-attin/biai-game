export function normalizeEmail(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const cleaned = raw.trim().toLowerCase();
  if (!cleaned) return '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleaned)) {
    return null;
  }
  return cleaned;
}
