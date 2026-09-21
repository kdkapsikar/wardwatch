const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const dateOnly = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

export const formatDateTime = (iso) => (iso ? dateTime.format(new Date(iso)) : '-');
export const formatDate = (iso) => (iso ? dateOnly.format(new Date(iso)) : '-');

export function formatHours(hours) {
  if (hours === null || hours === undefined) return '-';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} days`;
}

export const formatPercent = (value) => (value === null || value === undefined ? '-' : `${value.toFixed(1)}%`);

/** Indian rupees with lakh/crore grouping, e.g. 125000.5 -> "₹1,25,000.50". */
export function formatRupees(amount) {
  if (amount === null || amount === undefined) return '-';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Parse what a person types into an amount field: "1,25,000", "₹ 40000.5", "" -> null (no amount). */
export function parseBudget(input) {
  const cleaned = String(input ?? '').replace(/[\s,\u20B9]/g, '');
  if (cleaned === '') return { ok: true, value: null };
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return { ok: false, message: 'Enter a valid amount, e.g. 125000' };
  if (n < 0) return { ok: false, message: 'The amount cannot be negative' };
  if (n > 999_999_999_999.99) return { ok: false, message: 'That amount is too large' };
  return { ok: true, value: Math.round(n * 100) / 100 };
}
