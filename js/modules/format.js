// Parses YYYY-MM-DD as a local date (new Date('YYYY-MM-DD') would be UTC midnight).
function parseLocalDate(value) {
  if (value instanceof Date) return value;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const d = new Date(value);
  return isNaN(d) ? null : d;
}

// Local calendar date as YYYY-MM-DD (toISOString would give the UTC date).
export function toIsoDate(value = new Date()) {
  const d = parseLocalDate(value) || new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function plusDays(dateStr, days) {
  const parsed = parseLocalDate(dateStr);
  if (!parsed) return toIsoDate();
  const d = new Date(parsed.getTime());
  d.setDate(d.getDate() + Number(days || 0));
  return toIsoDate(d);
}

export function formatDateEnIn(value) {
  if (!value) return '--';
  const d = new Date(value);
  if (isNaN(d)) return '--';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function normalizeAmount(value) {
  const numeric = String(value || '').replace(/[^\d.-]/g, '');
  return parseFloat(numeric) || 0;
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
