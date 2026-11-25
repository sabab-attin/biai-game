export function normalizePhone(raw) {
  if (!raw || typeof raw !== 'string') return '';

  const cleaned = raw.trim().replace(/[\s().-]/g, '');
  if (!cleaned) return '';
  if (/^01[3-9]\d{8}$/.test(cleaned)) return cleaned;
  if (/^\+8801[3-9]\d{8}$/.test(cleaned)) return `0${cleaned.slice(4)}`;
  return null;
}
