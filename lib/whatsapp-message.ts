// WhatsApp order messages: merchant-editable templates with {placeholder}
// variables, rendered to a wa.me link. Pure functions, no React. Nothing is
// sent automatically: the merchant taps a button that opens WhatsApp.
// The variables, formatters and renderer live in lib/order-template.ts
// (shared with packing slips); this file keeps the WhatsApp-specific parts.

import {
  ORDER_TEMPLATE_VARIABLES,
  SAMPLE_ORDER,
  findUnknownPlaceholders,
  normalizeTemplateInput as normalizeOrderTemplateInput,
  renderTemplate as renderOrderTemplate,
  renderTemplateSegments as renderOrderTemplateSegments,
  type OrderTemplateData,
  type TemplateSegment,
} from "./order-template";
import { toPakistaniMobile } from "./phone";

export { MAX_ITEM_LINES } from "./order-template";
export { SAMPLE_ORDER, findUnknownPlaceholders };
export type { TemplateSegment };

export const MAX_TEMPLATE_LENGTH = 1000;

export const DEFAULT_CONFIRM_TEMPLATE = `Assalam o Alaikum {customer_name}!
{store_name} se order karne ka shukriya.

Order #{order_number}
{items}
Total: {total} (Cash on Delivery)
Address: {address}, {city}

Order confirm karne ke liye "YES" reply karein. Delivery {delivery_days} din mein hogi. Shukriya!`;

export const DEFAULT_MESSAGE_TEMPLATE =
  "Assalam o Alaikum {customer_name}! {store_name} se aap ke order #{order_number} ke baare mein raabta kar rahe hain.";

export type OrderMessageData = OrderTemplateData;

// Every variable a template can use (including the sender ones).
export const WHATSAPP_VARIABLES = ORDER_TEMPLATE_VARIABLES;

export function renderTemplateSegments(
  template: string | null | undefined,
  data: OrderMessageData,
  fallback: string = DEFAULT_MESSAGE_TEMPLATE,
): TemplateSegment[] {
  return renderOrderTemplateSegments(template, data, fallback);
}

export function renderTemplate(
  template: string | null | undefined,
  data: OrderMessageData,
  fallback: string = DEFAULT_MESSAGE_TEMPLATE,
): string {
  return renderOrderTemplate(template, data, fallback);
}

// Pakistani numbers to wa.me format (92 + 10 digits starting with 3), or null.
// The rule lives in lib/phone.ts (shared with checkout validation).
export const toWhatsAppNumber = toPakistaniMobile;

export function buildWhatsAppUrl(number: string, message: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export type WhatsAppKind = "confirm" | "message";

// Draft orders get the confirmation template; everything else the general one.
export const whatsAppKindFor = (status: string): WhatsAppKind =>
  status === "DRAFT" ? "confirm" : "message";

// Full link for an order, or null when the phone can't be used for WhatsApp.
export function buildOrderWhatsAppUrl(
  data: OrderMessageData,
  templates: { confirmTemplate: string | null; messageTemplate: string | null },
): string | null {
  const number = toWhatsAppNumber(data.phone);

  if (!number) return null;

  const message =
    whatsAppKindFor(data.status) === "confirm"
      ? renderTemplate(templates.confirmTemplate, data, DEFAULT_CONFIRM_TEMPLATE)
      : renderTemplate(templates.messageTemplate, data, DEFAULT_MESSAGE_TEMPLATE);

  return buildWhatsAppUrl(number, message);
}

// What to store for a WhatsApp template field: null (use the default) for
// blank text or text identical to the default; otherwise the trimmed text, at
// most 1000 characters.
export function normalizeTemplateInput(
  value: unknown,
  fallback: string,
): { error: string } | { value: string | null } {
  return normalizeOrderTemplateInput(value, fallback, { max: MAX_TEMPLATE_LENGTH });
}
