// Keep in sync with server/src/lib/constants.js and the DB CHECK constraints.

export const STATUS = {
  submitted:    { label: 'Submitted',    badge: 'bg-slate-100 text-slate-700 ring-slate-300',   bar: 'bg-slate-400',   dot: 'bg-slate-400', solid: 'bg-slate-600 text-white border-slate-600' },
  acknowledged: { label: 'Acknowledged', badge: 'bg-sky-50 text-sky-800 ring-sky-200',          bar: 'bg-sky-500',     dot: 'bg-sky-500', solid: 'bg-sky-600 text-white border-sky-600' },
  in_progress:  { label: 'In progress',  badge: 'bg-amber-50 text-amber-800 ring-amber-200',    bar: 'bg-amber-500',   dot: 'bg-amber-500', solid: 'bg-amber-500 text-white border-amber-500' },
  resolved:     { label: 'Resolved',     badge: 'bg-emerald-50 text-emerald-800 ring-emerald-200', bar: 'bg-emerald-500', dot: 'bg-emerald-500', solid: 'bg-emerald-600 text-white border-emerald-600' },
  rejected:     { label: 'Rejected',     badge: 'bg-rose-50 text-rose-800 ring-rose-200',       bar: 'bg-rose-400',    dot: 'bg-rose-400', solid: 'bg-rose-600 text-white border-rose-600' },
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

// One-tap starting points for the rejection reason (the corporator can edit the text afterwards).
export const REJECTION_SUGGESTIONS = [
  'Duplicate of an existing complaint',
  'Not under municipal jurisdiction',
  'Insufficient details to act on',
  'Already resolved',
  'Not a civic issue',
];

// Pie-chart colours: one FIXED colour per category (colour follows the category, never its size or
// rank), taken in order from the validated 8-hue categorical palette; "Other" is the neutral gray.
// Order = slot order, which is what the palette's adjacent-colour checks were validated against.
// Validated with the dataviz palette validator on the white card surface: every hard gate passes;
// aqua/yellow/magenta are under 3:1 contrast, so the chart always ships a legend table with the values.
export const CATEGORY_CHART = [
  { key: 'water', color: '#2a78d6' },
  { key: 'roads', color: '#eb6834' },
  { key: 'sanitation', color: '#1baf7a' },
  { key: 'streetlights', color: '#eda100' },
  { key: 'drainage', color: '#e87ba4' },
  { key: 'parks', color: '#008300' },
  { key: 'other', color: '#898781' },
];
