export function toIsoDate(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  return d.toISOString().slice(0, 10);
}

export function plusDays(dateStr, days) {
  const d = new Date(dateStr);
  if (isNaN(d)) return toIsoDate();
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
