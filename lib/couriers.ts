// Courier and tracking number on an order: the fixed courier list, display
// strings and the rules of PATCH /api/:storeId/orders/:orderId/shipping. A
// plain module (no Prisma, no server imports), so it is safe in the browser.
// Never changes status, stock, confirmedAt or payment.
// Rules: DECISIONS.md → Courier and tracking number.

export type CourierOption = { key: string; name: string };

export const OTHER_COURIER_KEY = "other";

// In select order. Keys are stable (stored in Order.courier); names are for
// display only. "other" uses the merchant's own name (Order.courierName).
export const COURIERS: readonly CourierOption[] = [
  { key: "tcs", name: "TCS" },
  { key: "leopards", name: "Leopards" },
  { key: "postex", name: "PostEx" },
  { key: "trax", name: "Trax" },
  { key: "mp", name: "M&P" },
  { key: "call-courier", name: "Call Courier" },
  { key: OTHER_COURIER_KEY, name: "Other courier" },
];

export const isCourierKey = (value: unknown): value is string =>
  typeof value === "string" && COURIERS.some((courier) => courier.key === value);

export const MAX_COURIER_NAME_LENGTH = 40;

// Letters, digits, spaces and dashes; 4–40 characters after trimming.
const TRACKING_NUMBER = /^[A-Za-z0-9 -]+$/;
const MIN_TRACKING_NUMBER_LENGTH = 4;
const MAX_TRACKING_NUMBER_LENGTH = 40;

// C0, DEL and C1 control characters.
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/;

// Code points, not UTF-16 units: an emoji outside the BMP counts as one.
const codePointLength = (text: string) => Array.from(text).length;

// Statuses in which courier details may be set or edited. Clearing is allowed
// in any status.
export const SHIPPABLE_STATUSES = ["CONFIRMED", "DELIVERED"] as const;

export type ShippableStatus = (typeof SHIPPABLE_STATUSES)[number];

export const isShippableStatus = (status: string) =>
  (SHIPPABLE_STATUSES as readonly string[]).includes(status);

export const ORDER_NOT_SHIPPABLE_MESSAGE = "Add courier details after confirming the order.";

export type CourierFields = {
  courier: string | null;
  courierName: string | null;
  trackingNumber: string | null;
};

// "TCS", or the merchant's name for "other"; "" for no or an unknown courier.
export function courierDisplayName(courier: string | null | undefined, courierName: string | null | undefined): string {
  if (!isCourierKey(courier)) return "";
  if (courier === OTHER_COURIER_KEY) return (courierName ?? "").trim() || "Other courier";

  return COURIERS.find((option) => option.key === courier)?.name ?? "";
}

// "TCS · 1234567890", or "" when the courier or tracking number isn't set.
export function formatCourierTracking(order: {
  courier?: string | null;
  courierName?: string | null;
  trackingNumber?: string | null;
}): string {
  const name = courierDisplayName(order.courier, order.courierName);
  const trackingNumber = (order.trackingNumber ?? "").trim();

  return name && trackingNumber ? `${name} · ${trackingNumber}` : "";
}

// What POST /track-order returns: { name, trackingNumber } only while the
// order is CONFIRMED or DELIVERED and both values are set. Never the key.
export function publicCourier(order: {
  status: string;
  courier?: string | null;
  courierName?: string | null;
  trackingNumber?: string | null;
}): { name: string; trackingNumber: string } | null {
  if (!isShippableStatus(order.status)) return null;

  const name = courierDisplayName(order.courier, order.courierName);
  const trackingNumber = (order.trackingNumber ?? "").trim();

  return name && trackingNumber ? { name, trackingNumber } : null;
}

export type ShippingPatchResult =
  | { value: CourierFields }
  | { error: "INVALID_REQUEST" | "INVALID_SHIPPING"; message: string };

const invalidShipping = (message: string): ShippingPatchResult => ({ error: "INVALID_SHIPPING", message });

const isOptionalString = (value: unknown) => value === undefined || value === null || typeof value === "string";

// The PATCH body { courier, courierName?, trackingNumber } or { courier: null }
// (clears all three). The first problem only. The values are what to store:
// trimmed; courierName only for "other" (null otherwise, ignored if sent).
export function parseShippingPatch(body: unknown): ShippingPatchResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { error: "INVALID_REQUEST", message: "Invalid request body" };
  }

  const { courier, courierName, trackingNumber } = body as Record<string, unknown>;

  if (courier === null) return { value: { courier: null, courierName: null, trackingNumber: null } };
  if (typeof courier !== "string" || !isOptionalString(courierName) || !isOptionalString(trackingNumber)) {
    return { error: "INVALID_REQUEST", message: "Invalid request body" };
  }

  if (!isCourierKey(courier)) return invalidShipping("Choose a courier");

  let name: string | null = null;
  if (courier === OTHER_COURIER_KEY) {
    name = typeof courierName === "string" ? courierName.trim() : "";
    if (!name) return invalidShipping("Enter the courier name");
    if (codePointLength(name) > MAX_COURIER_NAME_LENGTH) {
      return invalidShipping(`Courier name must be at most ${MAX_COURIER_NAME_LENGTH} characters`);
    }
    if (CONTROL_CHARS.test(name)) return invalidShipping("Courier name can't contain control characters");
  }

  const tracking = typeof trackingNumber === "string" ? trackingNumber.trim() : "";
  if (!tracking) return invalidShipping("Enter the tracking number");
  if (
    tracking.length < MIN_TRACKING_NUMBER_LENGTH ||
    tracking.length > MAX_TRACKING_NUMBER_LENGTH ||
    !TRACKING_NUMBER.test(tracking)
  ) {
    return invalidShipping("Tracking number must be 4–40 letters, numbers or dashes");
  }

  return { value: { courier, courierName: name, trackingNumber: tracking } };
}

export type ShippingPlan =
  | { kind: "error"; status: 409; error: "ORDER_NOT_SHIPPABLE"; message: string }
  | { kind: "noop" }
  | {
      kind: "update";
      /** Compare-and-set: the current values this update depends on. */
      where: { status: { in: ShippableStatus[] } } | CourierFields;
      data: CourierFields;
    };

// What a parsed PATCH does to an order in its current state. The route runs an
// "update" as a conditional updateMany; a miss is a lost race (409 CONFLICT).
export function planShippingUpdate(current: CourierFields & { status: string }, next: CourierFields): ShippingPlan {
  const same =
    current.courier === next.courier &&
    current.courierName === next.courierName &&
    current.trackingNumber === next.trackingNumber;

  if (next.courier === null) {
    if (same) return { kind: "noop" };

    return {
      kind: "update",
      where: { courier: current.courier, courierName: current.courierName, trackingNumber: current.trackingNumber },
      data: next,
    };
  }

  if (!isShippableStatus(current.status)) {
    return { kind: "error", status: 409, error: "ORDER_NOT_SHIPPABLE", message: ORDER_NOT_SHIPPABLE_MESSAGE };
  }
  if (same) return { kind: "noop" };

  return { kind: "update", where: { status: { in: [...SHIPPABLE_STATUSES] } }, data: next };
}
