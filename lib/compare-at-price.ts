import { Decimal } from "@prisma/client/runtime/library";

import { PreciseDecimal } from "@/lib/decimal";

export const COMPARE_AT_ERROR = "Compare-at price must be higher than the price";

const DECIMAL_PATTERN = /^\d+(\.\d+)?$/;

// Parses a request's `compareAtPrice` against the same request's `price`.
// - `undefined` (field missing) → { value: undefined }: POST means none,
//   PATCH means unchanged.
// - `null` / "" → { value: null }: no sale price (PATCH clears it).
// - otherwise it must be a positive decimal (JSON number or plain decimal
//   string, no exponent) strictly greater than `price`, else { error }.
// Money stays Decimal end to end; nothing goes through a float comparison.
export function parseCompareAtPrice(
  compareAtPrice: unknown,
  price: unknown,
): { error: string } | { value: Decimal | null | undefined } {
  if (compareAtPrice === undefined) {
    return { value: undefined };
  }

  if (compareAtPrice === null || (typeof compareAtPrice === "string" && compareAtPrice.trim() === "")) {
    return { value: null };
  }

  const text =
    typeof compareAtPrice === "number" && Number.isFinite(compareAtPrice)
      ? String(compareAtPrice)
      : typeof compareAtPrice === "string"
        ? compareAtPrice.trim()
        : "";

  if (!DECIMAL_PATTERN.test(text)) {
    return { error: COMPARE_AT_ERROR };
  }

  try {
    const value = new PreciseDecimal(text);
    const base = new PreciseDecimal(price as Decimal.Value);

    if (!value.greaterThan(0) || !value.greaterThan(base)) {
      return { error: COMPARE_AT_ERROR };
    }

    return { value };
  } catch {
    return { error: COMPARE_AT_ERROR };
  }
}

// Optional `limit` query param for the public products read: a positive
// integer, capped at 50; anything else is ignored (undefined).
export const MAX_PRODUCTS_LIMIT = 50;

export function parseProductsLimit(raw: string | null): number | undefined {
  if (raw === null || !/^\d+$/.test(raw.trim())) {
    return undefined;
  }

  const n = Number(raw.trim());

  return n >= 1 ? Math.min(n, MAX_PRODUCTS_LIMIT) : undefined;
}
