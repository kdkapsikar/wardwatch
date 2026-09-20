// Keep in sync with server/src/lib/constants.js and the DB CHECK constraints.

export const STATUS = {
  submitted:    { label: 'Submitted',    badge: 'bg-slate-100 text-slate-700 ring-slate-300',   bar: 'bg-slate-400',   dot: 'bg-slate-400' },
  acknowledged: { label: 'Acknowledged', badge: 'bg-sky-50 text-sky-800 ring-sky-200',          bar: 'bg-sky-500',     dot: 'bg-sky-500' },
  in_progress:  { label: 'In progress',  badge: 'bg-amber-50 text-amber-800 ring-amber-200',    bar: 'bg-amber-500',   dot: 'bg-amber-500' },
  resolved:     { label: 'Resolved',     badge: 'bg-emerald-50 text-emerald-800 ring-emerald-200', bar: 'bg-emerald-500', dot: 'bg-emerald-500' },
  rejected:     { label: 'Rejected',     badge: 'bg-rose-50 text-rose-800 ring-rose-200',       bar: 'bg-rose-400',    dot: 'bg-rose-400' },
};

export const STATUS_ORDER = ['submitted', 'acknowledged', 'in_progress', 'resolved', 'rejected'];

// Statuses a corporator can move an issue to.
export const CORPORATOR_STATUSES = ['acknowledged', 'in_progress', 'resolved', 'rejected'];

export const CATEGORIES = [
  { value: 'roads', label: 'Roads & potholes' },
  { value: 'water', label: 'Water supply' },
  { value: 'sanitation', label: 'Garbage & sanitation' },
  { value: 'streetlights', label: 'Street lights' },
  { value: 'drainage', label: 'Drainage & flooding' },
  { value: 'parks', label: 'Parks & public spaces' },
  { value: 'other', label: 'Other' },
];

export const categoryLabel = (value) => CATEGORIES.find((c) => c.value === value)?.label ?? value;

export const MAX_PHOTOS = 5;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Where the report-form map starts before a location is chosen. Set VITE_MAP_CENTER="lat,lng"
// (and optionally VITE_MAP_ZOOM) in client/.env to centre it on your city. Defaults to a view of India.
const [centerLat, centerLng] = (import.meta.env.VITE_MAP_CENTER ?? '').split(',').map(Number);
export const DEFAULT_MAP_CENTER =
  Number.isFinite(centerLat) && Number.isFinite(centerLng) ? [centerLat, centerLng] : [20.5937, 78.9629];
export const DEFAULT_MAP_ZOOM = Number(import.meta.env.VITE_MAP_ZOOM) || (import.meta.env.VITE_MAP_CENTER ? 13 : 5);
