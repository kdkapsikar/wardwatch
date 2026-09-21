import { z } from 'zod';
import { HttpError } from './httpError.js';
import { CATEGORIES, CORPORATOR_STATUSES } from './constants.js';

/** Validate `data` with a zod schema; throw a 400 with per-field messages on failure. */
export function parse(schema, data) {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  const fields = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_';
    fields[key] ??= issue.message;
  }
  throw new HttpError(400, 'validation_error', 'Please fix the highlighted fields', fields);
}

// Trimmed string; missing values are treated as '' so the message is always our own.
const text = (label, { min = 1, max }) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() : ''),
    z
      .string()
      .min(1, `${label} is required`)
      .min(min, `${label} must be at least ${min} characters`)
      .max(max, `${label} must be at most ${max} characters`),
  );

const optionalText = (label, max) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined),
    z.string().max(max, `${label} must be at most ${max} characters`).optional(),
  );

/**
 * Indian mobile number: 10 digits starting with 6-9. Spaces, dashes and brackets are ignored and a
 * leading +91 / 91 / 0 is accepted and dropped, so "+91 98765-43210" and "09876543210" both become
 * "9876543210". Returns null when the input is not a valid mobile number.
 */
export function normalizeIndianMobile(input) {
  // Devanagari digits (\u0966-\u096F) are accepted: a Marathi keyboard types them.
  const latin = String(input ?? '').replace(/[\u0966-\u096F]/g, (d) => String(d.charCodeAt(0) - 0x0966));
  const compact = latin.replace(/[\s()-]/g, '');
  const match = compact.match(/^(?:\+91|91|0)?([6-9]\d{9})$/);
  return match ? match[1] : null;
}

const phone = z.preprocess(
  (v) => normalizeIndianMobile(v) ?? '',
  z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
);

// Ticked checkbox arrives as the string "true" in multipart form data.
const consent = z.preprocess(
  (v) => v === true || v === 'true',
  z.literal(true, { message: 'Please confirm the declaration to submit' }),
);

// Decimal degrees from the map picker. Rounded to 6 places (~0.1 m) - more is false precision.
const coordinate = (label, min, max) =>
  z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? NaN : Number(v)),
    z
      .number({ message: 'Select the issue location on the map' })
      .min(min, `${label} is out of range`)
      .max(max, `${label} is out of range`)
      .transform((n) => Math.round(n * 1e6) / 1e6),
  );

export const issueSchema = z.object({
  ward_id: z.preprocess((v) => Number(v), z.number().int().positive('Select your constituency')),
  category: z.preprocess((v) => v ?? '', z.enum(CATEGORIES, { message: 'Select a category' })),
  description: text('Description', { min: 10, max: 2000 }),
  address: optionalText('Address / landmark', 200),
  latitude: coordinate('Latitude', -90, 90),
  longitude: coordinate('Longitude', -180, 180),
  name: text('Full name', { min: 2, max: 100 }),
  phone,
  consent,
});

export const loginSchema = z.object({
  username: text('Username', { max: 100 }),
  password: z.preprocess((v) => (typeof v === 'string' ? v : ''), z.string().min(1, 'Password is required').max(200)),
});

// The remark is always optional. Rejecting requires a rejection_reason - enforced in
// services/issues.js, where the issue's current status is known.
export const updateSchema = z.object({
  status: z.preprocess(
    (v) => (v === '' || v === undefined ? undefined : v),
    z.enum(CORPORATOR_STATUSES, { message: 'Invalid status' }).optional(),
  ),
  remark: optionalText('Remark', 1000),
  rejection_reason: optionalText('Rejection reason', 500),
});

export const transferSchema = z.object({
  ward_id: z.preprocess((v) => Number(v), z.number().int().positive('Choose a constituency')),
  note: optionalText('Note', 500),
});

export const listQuerySchema = z.object({
  status: z.preprocess(
    (v) => (v === '' || v === 'all' ? undefined : v),
    z.enum(['submitted', 'acknowledged', 'in_progress', 'resolved', 'rejected', 'open']).optional(),
  ),
  category: z.preprocess((v) => (v === '' ? undefined : v), z.enum(CATEGORIES).optional()),
  overdue: z.preprocess((v) => v === '1' || v === 'true', z.boolean()),
  page: z.preprocess((v) => (v === undefined ? 1 : Number(v)), z.number().int().min(1).max(10_000)),
});

// Admin issue list: same filters as the corporator inbox plus a constituency number.
export const adminListQuerySchema = listQuerySchema.extend({
  ward: z.preprocess((v) => (v === undefined || v === '' ? undefined : Number(v)), z.number().int().min(1).max(10_000).optional()),
});

// Rupees, optional. Accepts 125000, "1,25,000.50", "₹ 1,25,000"; empty / null means "no amount".
const MAX_BUDGET = 999_999_999_999.99;
const budgetAmount = z.preprocess(
  (v) => {
    if (v === undefined || v === null) return null;
    if (typeof v === 'number') return v;
    const cleaned = String(v).replace(/[\s,\u20B9]/g, '');
    return cleaned === '' ? null : Number(cleaned);
  },
  z
    .number({ message: 'Enter a valid amount' })
    .min(0, 'The amount cannot be negative')
    .max(MAX_BUDGET, 'That amount is too large')
    .transform((n) => Math.round(n * 100) / 100)
    .nullable(),
);

export const noteSchema = z.object({
  body: text('Note', { min: 1, max: 2000 }),
  budget_amount: budgetAmount,
});
