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
