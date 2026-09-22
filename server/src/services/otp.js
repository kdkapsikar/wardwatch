import { config } from '../config.js';

// PLACEHOLDER until an SMS gateway is wired in: every phone number's code is the same fixed value
// (config.otpCode, default "1111") and nothing is actually sent. Swap this file for a real SMS send
// with a random per-phone code (stored with an expiry, single use) when the subscription is ready -
// routes/citizen.js only calls sendOtp/verifyOtp, so nothing else needs to change.

/** "Sends" the code to `phone`. Always succeeds for a well-formed number. */
export async function sendOtp(_phone) {
  // No-op for now.
}

/** True if `code` is the correct OTP for `phone` right now. */
export function verifyOtp(_phone, code) {
  return code === config.otpCode;
}
