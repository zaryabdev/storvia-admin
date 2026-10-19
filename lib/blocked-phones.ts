// Phone blocklist rules, shared by the order engine (lib/order-create.ts), the
// merchant routes and the Admin UI. A plain module (no Prisma, no server
// imports), so it is safe in the browser. Rules: DECISIONS.md → Phone blocklist.

import { PAKISTANI_MOBILE_MESSAGE, toPakistaniMobile } from "./phone";

/** The plain-text 400 a shopper sees when /cod or /checkout refuses the order. */
export const BLOCKED_ORDER_MESSAGE = "We couldn't place this order. Please contact the store on WhatsApp.";

export const MAX_BLOCKED_PHONES = 1000;
export const BLOCKED_PHONES_LIMIT_ERROR = "You can block up to 1,000 numbers.";

export const MAX_BLOCKED_NOTE_LENGTH = 200;

const INVALID_BODY_ERROR = "Invalid request body";
const NOTE_TOO_LONG_ERROR = `Reason must be at most ${MAX_BLOCKED_NOTE_LENGTH} characters`;
const NOTE_CONTROL_ERROR = "Reason can't contain control characters";

// C0, DEL and C1 control characters.
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/;

// Code points, not UTF-16 units: an emoji outside the BMP counts as one.
const codePointLength = (text: string) => Array.from(text).length;

// "pk:" + the 92… form of a Pakistani mobile (identical to customerKey for
// mobiles), so "0300 1234567", "+92 300 1234567" and "923001234567" are one
// key. Anything else can't be blocked: null.
export function blockedPhoneKey(phone: unknown): string | null {
  if (typeof phone !== "string") return null;

  const mobile = toPakistaniMobile(phone.trim());
  return mobile ? `pk:${mobile}` : null;
}

export type BlockedPhoneInput = {
  phoneKey: string;
  /** As entered, trimmed (for display). */
  phone: string;
  /** Trimmed; blank → null. */
  note: string | null;
};

// The merchant POST body { phone, note? }. The first problem only.
export function parseBlockedPhoneInput(body: unknown): { value: BlockedPhoneInput } | { error: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return { error: INVALID_BODY_ERROR };

  const { phone, note } = body as Record<string, unknown>;
  if (typeof phone !== "string") return { error: INVALID_BODY_ERROR };
  if (note !== undefined && note !== null && typeof note !== "string") return { error: INVALID_BODY_ERROR };

  const phoneKey = blockedPhoneKey(phone);
  if (!phoneKey) return { error: PAKISTANI_MOBILE_MESSAGE };

  const trimmedNote = typeof note === "string" ? note.trim() : "";
  if (codePointLength(trimmedNote) > MAX_BLOCKED_NOTE_LENGTH) return { error: NOTE_TOO_LONG_ERROR };
  if (CONTROL_CHARS.test(trimmedNote)) return { error: NOTE_CONTROL_ERROR };

  return { value: { phoneKey, phone: phone.trim(), note: trimmedNote || null } };
}

/** One blocked number as the merchant API returns it (and the Admin UI shows it). */
export type BlockedPhoneItem = {
  id: string;
  phone: string;
  note: string | null;
  /** ISO 8601. */
  createdAt: string;
};

export const toBlockedPhoneItem = (row: {
  id: string;
  phone: string;
  note: string | null;
  createdAt: Date;
}): BlockedPhoneItem => ({
  id: row.id,
  phone: row.phone,
  note: row.note,
  createdAt: row.createdAt.toISOString(),
});
