// Guest order tracking rules (POST /api/:storeId/track-order). Pure functions,
// no dependencies besides lib/phone.ts. Rules: DECISIONS.md → Guest order tracking.

import { toPakistaniMobile } from "./phone";

// Longer typed ids are answered with the normal not-found response.
export const MAX_TRACKING_ID_LENGTH = 100;

// Exact-match candidates for a typed id (already trimmed). Ids are generated
// in one case: "ORD-…" uppercase, legacy 12-character hex lowercase, so these
// cover a shopper typing either in any case without a pattern (ILIKE) match.
export function trackingIdCandidates(trackingId: string): string[] {
  return Array.from(new Set([trackingId, trackingId.toUpperCase(), trackingId.toLowerCase()]));
}

const digitsOnly = (phone: string) => phone.replace(/\D/g, "");

// Whether the phone typed by the shopper is the order's checkout phone. Two
// Pakistani mobiles compare in wa.me form, so "0300 1234567", "+92 300 1234567"
// and "923001234567" all match; anything else (legacy orders) compares
// digits only. A phone without digits never matches.
export function phonesMatch(storedPhone: string | null | undefined, typedPhone: string | null | undefined): boolean {
  if (typeof storedPhone !== "string" || typeof typedPhone !== "string") return false;

  const storedMobile = toPakistaniMobile(storedPhone);
  const typedMobile = toPakistaniMobile(typedPhone);
  if (storedMobile && typedMobile) return storedMobile === typedMobile;

  const storedDigits = digitsOnly(storedPhone);
  const typedDigits = digitsOnly(typedPhone);

  return storedDigits.length > 0 && storedDigits === typedDigits;
}
