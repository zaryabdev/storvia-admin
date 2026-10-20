// Store pages: About, Contact, Returns & exchanges and FAQ. Pure rules shared by
// the merchant route, the public routes and the Settings form. No Prisma import
// (usable client- and server-side).
//
// Page text is plain text with its line breaks kept. A page is live (public)
// only while enabled AND it has content (text, or at least one FAQ question).
// Turning a page off keeps its text and questions.

export const STORE_PAGE_KINDS = ["ABOUT", "CONTACT", "RETURNS", "FAQ"] as const;

export type StorePageKindValue = (typeof STORE_PAGE_KINDS)[number];
export type TextPageKind = Exclude<StorePageKindValue, "FAQ">;

export const TEXT_PAGE_KINDS: readonly TextPageKind[] = ["ABOUT", "CONTACT", "RETURNS"];

export const STORE_PAGE_LABELS: Record<StorePageKindValue, string> = {
  ABOUT: "About",
  CONTACT: "Contact",
  RETURNS: "Returns & exchanges",
  FAQ: "FAQ",
};

export const TEXT_PAGE_LIMITS: Record<TextPageKind, number> = {
  ABOUT: 5000,
  CONTACT: 2000,
  RETURNS: 5000,
};

export const MAX_FAQ_ITEMS = 20;
export const MAX_FAQ_QUESTION_LENGTH = 200;
export const MAX_FAQ_ANSWER_LENGTH = 1000;

// The public route's lowercase kinds: /api/{storeId}/pages/{slug}.
export const STORE_PAGE_SLUGS: Record<StorePageKindValue, "about" | "contact" | "returns" | "faq"> = {
  ABOUT: "about",
  CONTACT: "contact",
  RETURNS: "returns",
  FAQ: "faq",
};

const INVALID_BODY_ERROR = "Invalid request body";
const UNKNOWN_PAGE_ERROR = "Unknown page";
export const FAQ_EMPTY_ERROR = "Add at least one question, or turn the FAQ off";
export const FAQ_TOO_MANY_ERROR = `You can add up to ${MAX_FAQ_ITEMS} questions.`;

// 5000 → "5,000" (the same in every runtime, unlike toLocaleString).
export const formatCount = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export const pageTooLongError = (kind: TextPageKind) =>
  `${STORE_PAGE_LABELS[kind]} must be at most ${formatCount(TEXT_PAGE_LIMITS[kind])} characters`;

export const pageEmptyError = (kind: TextPageKind) =>
  `Add the ${STORE_PAGE_LABELS[kind]} text, or turn the page off`;

export type FaqItem = { question: string; answer: string };

// The merchant GET/PATCH response shape: all four pages in order (a page never
// saved reads as off with no text; FAQ body is always null), then the FAQ
// questions in order.
export type StorePageSettings = { kind: StorePageKindValue; enabled: boolean; body: string | null };
export type StorePagesSettings = { pages: StorePageSettings[]; faqItems: FaqItem[] };

// A validated merchant PATCH: one page per request.
export type StorePagePatch =
  | { kind: TextPageKind; enabled: boolean; body: string | null }
  | { kind: "FAQ"; enabled: boolean; items: FaqItem[] };

export const isStorePageKind = (value: unknown): value is StorePageKindValue =>
  typeof value === "string" && (STORE_PAGE_KINDS as readonly string[]).includes(value);

// C0, DEL and C1 control characters, except LF.
const CONTROL_CHARS = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/;

// Code points, not UTF-16 units: an emoji outside the BMP counts as one.
export const codePointLength = (text: string) => Array.from(text).length;

// CRLF / CR → LF and tabs → a space. Any other control character left after
// this (checked before trimming, so none is silently dropped) is rejected.
const prepareText = (text: string) => text.replace(/\r\n?/g, "\n").replace(/\t/g, " ");

// Page text and FAQ answers: the above, then trailing spaces trimmed per line,
// runs of blank lines collapsed to one, and the whole text trimmed.
export const normalizePageText = (text: string) =>
  prepareText(text)
    .replace(/[^\S\n]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

// FAQ questions are one line: all whitespace (newlines too) collapses to one space.
export const normalizeFaqQuestion = (text: string) => text.replace(/\s+/g, " ").trim();

type TextResult = { value: string | null } | { error: string };

// A text field: control characters → the error; normalised; blank → null;
// more than `max` code points → the error. Also used by lib/product-description.ts.
export function checkText(
  raw: string,
  normalize: (text: string) => string,
  max: number,
  errors: { control: string; tooLong: string },
): TextResult {
  if (CONTROL_CHARS.test(prepareText(raw))) return { error: errors.control };

  const text = normalize(raw);
  if (text === "") return { value: null };
  if (codePointLength(text) > max) return { error: errors.tooLong };
  return { value: text };
}

// One text page's body: null / blank → null; a non-string → invalid body.
export function parsePageText(kind: TextPageKind, raw: unknown): TextResult {
  if (raw === null || raw === undefined) return { value: null };
  if (typeof raw !== "string") return { error: INVALID_BODY_ERROR };

  return checkText(raw, normalizePageText, TEXT_PAGE_LIMITS[kind], {
    control: `${STORE_PAGE_LABELS[kind]} can't contain control characters`,
    tooLong: pageTooLongError(kind),
  });
}

// One FAQ item (index 0-based) → the normalised item, or "Question N: …".
export function parseFaqItem(raw: unknown, index: number): { value: FaqItem } | { error: string } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { error: INVALID_BODY_ERROR };

  const { question, answer } = raw as Record<string, unknown>;
  const asText = (value: unknown) => (value === null || value === undefined ? "" : value);
  const q = asText(question);
  const a = asText(answer);
  if (typeof q !== "string" || typeof a !== "string") return { error: INVALID_BODY_ERROR };

  const prefix = `Question ${index + 1}: `;

  const parsedQuestion = checkText(q, normalizeFaqQuestion, MAX_FAQ_QUESTION_LENGTH, {
    control: `${prefix}Question can't contain control characters`,
    tooLong: `${prefix}Question must be at most ${formatCount(MAX_FAQ_QUESTION_LENGTH)} characters`,
  });
  if ("error" in parsedQuestion) return parsedQuestion;
  if (parsedQuestion.value === null) return { error: `${prefix}Question is required` };

  const parsedAnswer = checkText(a, normalizePageText, MAX_FAQ_ANSWER_LENGTH, {
    control: `${prefix}Answer can't contain control characters`,
    tooLong: `${prefix}Answer must be at most ${formatCount(MAX_FAQ_ANSWER_LENGTH)} characters`,
  });
  if ("error" in parsedAnswer) return parsedAnswer;
  if (parsedAnswer.value === null) return { error: `${prefix}Answer is required` };

  return { value: { question: parsedQuestion.value, answer: parsedAnswer.value } };
}

// The whole FAQ list, in order: at most 20, every item valid.
export function parseFaqItems(raw: unknown): { value: FaqItem[] } | { error: string } {
  if (!Array.isArray(raw)) return { error: INVALID_BODY_ERROR };
  if (raw.length > MAX_FAQ_ITEMS) return { error: FAQ_TOO_MANY_ERROR };

  const items: FaqItem[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = parseFaqItem(raw[i], i);
    if ("error" in item) return item;
    items.push(item.value);
  }

  return { value: items };
}

// Validates a merchant PATCH body before any write. Text pages:
// { kind, enabled, body }; FAQ: { kind: "FAQ", enabled, items: [{ question, answer }] }.
// The page is replaced as sent (turning it off with its text kept = send the
// text with enabled false). Returns the normalised page, or the first problem
// as plain text.
export function parseStorePagePatch(body: unknown): { value: StorePagePatch } | { error: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { error: INVALID_BODY_ERROR };
  }

  const raw = body as Record<string, unknown>;
  if (!isStorePageKind(raw.kind)) return { error: UNKNOWN_PAGE_ERROR };
  if (typeof raw.enabled !== "boolean") return { error: INVALID_BODY_ERROR };

  const kind = raw.kind;
  const enabled = raw.enabled;

  if (kind === "FAQ") {
    const items = parseFaqItems(raw.items);
    if ("error" in items) return items;
    if (enabled && items.value.length === 0) return { error: FAQ_EMPTY_ERROR };
    return { value: { kind, enabled, items: items.value } };
  }

  const text = parsePageText(kind, raw.body);
  if ("error" in text) return text;
  if (enabled && text.value === null) return { error: pageEmptyError(kind) };

  return { value: { kind, enabled, body: text.value } };
}

// ---------------------------------------------------------------------------
// Reads

export const STORE_PAGE_SELECT = { kind: true, enabled: true, body: true } as const;
export const FAQ_ITEM_SELECT = { question: true, answer: true } as const;
// Merchant order; ties (none expected) break by creation time.
export const FAQ_ITEM_ORDER = [{ position: "asc" as const }, { createdAt: "asc" as const }];

// The stored rows → the merchant shape (missing rows read as off, no text).
export function toStorePagesSettings(
  rows: { kind: StorePageKindValue; enabled: boolean; body: string | null }[],
  faqItems: FaqItem[],
): StorePagesSettings {
  return {
    pages: STORE_PAGE_KINDS.map((kind) => {
      const row = rows.find((r) => r.kind === kind);
      return { kind, enabled: row?.enabled ?? false, body: kind === "FAQ" ? null : row?.body ?? null };
    }),
    faqItems: faqItems.map(({ question, answer }) => ({ question, answer })),
  };
}

// The public Store GET `pages` flags. `liveKinds` = the kinds of the enabled
// pages that have a stored body (any enabled FAQ row); the FAQ is live only
// with at least one question.
export function publicPageFlags(
  liveKinds: StorePageKindValue[],
  faqItemCount: number,
): { about: boolean; contact: boolean; returns: boolean; faq: boolean } {
  return {
    about: liveKinds.includes("ABOUT"),
    contact: liveKinds.includes("CONTACT"),
    returns: liveKinds.includes("RETURNS"),
    faq: liveKinds.includes("FAQ") && faqItemCount > 0,
  };
}

// The public slug → kind, or null for anything else (exact lowercase only).
export const pageKindFromSlug = (slug: unknown): StorePageKindValue | null =>
  STORE_PAGE_KINDS.find((kind) => STORE_PAGE_SLUGS[kind] === slug) ?? null;

// A stored body re-checked on the way out: the normalised text, or null when
// blank or no longer valid.
export function publicPageBody(kind: TextPageKind, body: string | null): string | null {
  const text = parsePageText(kind, body);
  return "value" in text ? text.value : null;
}

// Stored FAQ items re-checked on the way out: invalid ones are dropped, at most 20.
export function publicFaqItems(items: FaqItem[]): FaqItem[] {
  const valid: FaqItem[] = [];
  for (const item of items) {
    if (valid.length === MAX_FAQ_ITEMS) break;
    const parsed = parseFaqItem(item, valid.length);
    if ("value" in parsed) valid.push(parsed.value);
  }
  return valid;
}
