// Client-side checks for instant feedback. The server re-validates everything with the same rules
// (server/src/lib/validation.js) and is the authority.

/** Devanagari digits (०-९) -> 0-9, so a Marathi keyboard works in numeric fields. */
export const toLatinDigits = (s) => String(s ?? '').replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x0966));

/**
 * Indian mobile number: 10 digits starting with 6-9. Spaces, dashes and brackets are ignored and a
 * leading +91 / 91 / 0 is accepted. Returns the bare 10 digits, or null if invalid.
 */
export function normalizeIndianMobile(input) {
  const compact = toLatinDigits(input).replace(/[\s()-]/g, '');
  const match = compact.match(/^(?:\+91|91|0)?([6-9]\d{9})$/);
  return match ? match[1] : null;
}

/** Returns { field: message } for every problem with the report form; {} when valid. `t` translates. */
export function validateReport(values, t) {
  const errors = {};
  if (!values.ward_id) errors.ward_id = t('val.ward');
  if (!values.category) errors.category = t('val.category');

  const description = values.description.trim();
  if (!description) errors.description = t('val.description.required');
  else if (description.length < 10) errors.description = t('val.description.min');

  const name = values.name.trim();
  if (!name) errors.name = t('val.name.required');
  else if (name.length < 2) errors.name = t('val.name.min');

  if (!normalizeIndianMobile(values.phone)) errors.phone = t('val.phone');

  if (values.latitude === null || values.longitude === null) errors.latitude = t('val.location');
  if (!values.consent) errors.consent = t('val.consent');
  return errors;
}
