// Product description: optional plain text shown on the product page. Pure rules
// shared by the product routes and the product form. No Prisma import (usable
// client- and server-side).
//
// Same text rules as the Store pages (lib/store-pages.ts): CRLF / CR → LF, tabs →
// a space, trailing spaces trimmed per line, runs of blank lines collapsed to one,
// the whole text trimmed, any other control character rejected, length counted in
// code points after normalising.

import { checkText, codePointLength, formatCount, normalizePageText } from "@/lib/store-pages";

export const MAX_PRODUCT_DESCRIPTION_LENGTH = 5000;

export const DESCRIPTION_TOO_LONG_ERROR = `Description must be at most ${formatCount(MAX_PRODUCT_DESCRIPTION_LENGTH)} characters`;
export const DESCRIPTION_CONTROL_ERROR = "Description can't contain control characters";
const INVALID_DESCRIPTION_ERROR = "Invalid request body";

// A request's `description`:
// - `undefined` (field missing) → { value: undefined }: POST means none,
//   PATCH means unchanged.
// - `null` / blank → { value: null }: no description (PATCH clears it).
// - otherwise the normalised text, or the first problem as plain text.
export function parseProductDescription(raw: unknown): { value: string | null | undefined } | { error: string } {
  if (raw === undefined) return { value: undefined };
  if (raw === null) return { value: null };
  if (typeof raw !== "string") return { error: INVALID_DESCRIPTION_ERROR };

  return checkText(raw, normalizePageText, MAX_PRODUCT_DESCRIPTION_LENGTH, {
    control: DESCRIPTION_CONTROL_ERROR,
    tooLong: DESCRIPTION_TOO_LONG_ERROR,
  });
}

// The form's counter: code points after normalising.
export const productDescriptionLength = (text: string) => codePointLength(normalizePageText(text));

// A stored description re-checked on the way out: the normalised text, or null
// when blank or no longer valid.
export function publicProductDescription(description: string | null): string | null {
  const text = parseProductDescription(description);
  return "value" in text ? text.value ?? null : null;
}
