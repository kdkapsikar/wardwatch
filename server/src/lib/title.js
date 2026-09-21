const MAX_LENGTH = 80;
const MIN_LENGTH = 5; // matches the CHECK constraint on issues.title
const FALLBACK = 'Citizen report';

/**
 * The form no longer asks for a title, but the inbox and tracking page still need a one-line headline,
 * so use the start of the description: whitespace collapsed, cut at a word boundary, "…" if shortened.
 */
export function deriveTitle(description) {
  const text = String(description ?? '').replace(/\s+/g, ' ').trim();
  if (text.length < MIN_LENGTH) return FALLBACK;
  if (text.length <= MAX_LENGTH) return text;
  const cut = text.slice(0, MAX_LENGTH);
  const lastSpace = cut.lastIndexOf(' ');
  const base = lastSpace > MAX_LENGTH / 2 ? cut.slice(0, lastSpace) : cut;
  return `${base.replace(/[\s,;:.\-]+$/, '')}…`;
}
