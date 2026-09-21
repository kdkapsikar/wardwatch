// Client-side checks for instant feedback. The server re-validates everything with the same rules
// (server/src/lib/validation.js) and is the authority.

/**
 * Indian mobile number: 10 digits starting with 6-9. Spaces, dashes and brackets are ignored and a
 * leading +91 / 91 / 0 is accepted. Returns the bare 10 digits, or null if invalid.
 */
export function normalizeIndianMobile(input) {
  const compact = String(input ?? '').replace(/[\s()-]/g, '');
  const match = compact.match(/^(?:\+91|91|0)?([6-9]\d{9})$/);
  return match ? match[1] : null;
}

/** Returns { field: message } for every problem with the report form; {} when valid. */
export function validateReport(values) {
  const errors = {};
  if (!values.ward_id) errors.ward_id = 'Select your constituency';
  if (!values.category) errors.category = 'Select a category';

  const title = values.title.trim();
  if (!title) errors.title = 'Title is required';
  else if (title.length < 5) errors.title = 'Title must be at least 5 characters';

  const description = values.description.trim();
  if (!description) errors.description = 'Description is required';
  else if (description.length < 10) errors.description = 'Description must be at least 10 characters';

  const name = values.name.trim();
  if (!name) errors.name = 'Full name is required';
  else if (name.length < 2) errors.name = 'Full name must be at least 2 characters';

  if (!normalizeIndianMobile(values.phone)) errors.phone = 'Enter a valid 10-digit Indian mobile number';

  if (values.latitude === null || values.longitude === null) errors.latitude = 'Select the issue location on the map';
  if (!values.consent) errors.consent = 'Please confirm the declaration to submit';
  return errors;
}
