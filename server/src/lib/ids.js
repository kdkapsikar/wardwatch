import { randomInt } from 'node:crypto';

// No I, L, O, 0, 1 - IDs get read out over the phone and typed from paper.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const PUBLIC_ID_RE = /^WW-[A-Z2-9]{8}$/;

/** e.g. "WW-7K3M9QXA" (31^8 ~ 8.5e11 combinations, cryptographically random). */
export function generatePublicId() {
  let id = '';
  for (let i = 0; i < 8; i += 1) id += ALPHABET[randomInt(ALPHABET.length)];
  return `WW-${id}`;
}

/** Tolerate lowercase, stray spaces and a missing dash. Returns null if malformed. */
export function normalizePublicId(input) {
  const cleaned = String(input ?? '').trim().toUpperCase().replace(/\s+/g, '');
  const withDash = /^WW[A-Z2-9]{8}$/.test(cleaned) ? `WW-${cleaned.slice(2)}` : cleaned;
  return PUBLIC_ID_RE.test(withDash) ? withDash : null;
}
