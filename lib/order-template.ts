// Order templates: merchant-editable text with {placeholder} variables, filled
// from an order. Shared by WhatsApp order messages (lib/whatsapp-message.ts)
// and packing slips (lib/packing-slip.ts). Pure functions, no React.

export const MAX_ITEM_LINES = 10;

// What a template can read. Plain values only, so the same function renders
// real orders (server) and the sample order (Settings preview).
export interface OrderTemplateData {
  storeName: string;
  trackingId: string;
  createdAt: Date | string;
  status: string;
  paymentMethod: string;
  customerName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postalCode: string;
  country: string;
  /** Legacy single-string address, used only when every structured part is empty. */
  legacyAddress?: string;
  customerNotes: string;
  /** null when unknown (legacy orders). */
  subtotal: number | null;
  total: number | null;
  items: Array<{ name: string; size?: string | null; color?: string | null; quantity: number }>;
  /** The order's delivery fee snapshot as a decimal string; null/undefined = unknown (legacy order). */
  deliveryFee?: string | null;
  /** The Store's current delivery time label, e.g. "2–3" (formatDeliveryDays). */
  deliveryDays?: string;
  /** The Store's sender details (Settings); missing = empty string. */
  senderName?: string | null;
  senderPhone?: string | null;
  senderAddress?: string | null;
  senderCity?: string | null;
}

const money = new Intl.NumberFormat("en-PK", {
  style: "currency",
  currency: "PKR",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

// Same format as the Admin formatter ("Rs 4,500"), with plain spaces for WhatsApp.
export const formatMoney = (value: number | null) =>
  value === null || !Number.isFinite(value) ? "" : money.format(value).replace(/ /g, " ");

// "Rs 200", "Free" for zero, "" when unknown. Zero is checked on the decimal
// string itself; the number is only for display formatting.
export const formatDeliveryFee = (value: string | null | undefined) =>
  value == null || value.trim() === ""
    ? ""
    : /^0*(\.0*)?$/.test(value.trim())
      ? "Free"
      : formatMoney(Number(value));

// "6 Oct 2026", in Pakistan time.
export const formatDate = (value: Date | string) => {
  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Karachi",
      }).format(date);
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Pending",
  CONFIRMED: "Confirmed",
  DELIVERED: "Delivered",
  CANCELED: "Canceled",
};

const PAYMENT_LABELS: Record<string, string> = {
  COD: "Cash on Delivery",
};

const COUNTRY_NAMES: Record<string, string> = { PK: "Pakistan" };

// "• Name (S, Blue) × 2", at most 10 lines, then "…aur N aur items".
function formatItems(items: OrderTemplateData["items"]) {
  const lines = items.slice(0, MAX_ITEM_LINES).map((item) => {
    const options = [item.size, item.color].filter((part) => part && part.trim()).join(", ");

    return `• ${item.name}${options ? ` (${options})` : ""} × ${item.quantity}`;
  });

  if (items.length > MAX_ITEM_LINES) {
    lines.push(`…aur ${items.length - MAX_ITEM_LINES} aur items`);
  }

  return lines.join("\n");
}

function resolveVariables(data: OrderTemplateData): Record<string, string> {
  const country = COUNTRY_NAMES[data.country] ?? data.country;
  const parts = [data.addressLine1, data.addressLine2, data.city, data.postalCode, country]
    .map((part) => (part ?? "").trim())
    .filter(Boolean);
  const structured = [data.addressLine1, data.addressLine2, data.city, data.postalCode].some((part) =>
    (part ?? "").trim(),
  );
  const legacy = (data.legacyAddress ?? "").trim();

  return {
    customer_name: data.customerName,
    customer_phone: data.phone,
    customer_email: data.email,
    store_name: data.storeName,
    order_number: data.trackingId,
    order_date: formatDate(data.createdAt),
    order_status: STATUS_LABELS[data.status] ?? data.status,
    payment_method: PAYMENT_LABELS[data.paymentMethod] ?? data.paymentMethod,
    items: formatItems(data.items),
    item_count: String(data.items.reduce((sum, item) => sum + item.quantity, 0)),
    subtotal: formatMoney(data.subtotal),
    total: formatMoney(data.total),
    address: data.addressLine1.trim() || (structured ? "" : legacy),
    address_line2: data.addressLine2,
    city: data.city,
    postal_code: data.postalCode,
    country,
    full_address: structured ? parts.join(", ") : legacy,
    delivery_notes: data.customerNotes,
    delivery_fee: formatDeliveryFee(data.deliveryFee),
    delivery_days: data.deliveryDays ?? "",
    sender_name: data.senderName ?? "",
    sender_phone: data.senderPhone ?? "",
    sender_address: data.senderAddress ?? "",
    sender_city: data.senderCity ?? "",
  };
}

// Every variable the order data supports, in the order the help modal shows
// them. `example` matches SAMPLE_ORDER below.
export const ORDER_TEMPLATE_VARIABLES: Array<{
  key: string;
  label: string;
  description: string;
  example: string;
}> = [
  { key: "customer_name", label: "Customer name", description: "The name the customer entered at checkout.", example: "Ali Raza" },
  { key: "customer_phone", label: "Customer phone", description: "The phone number the customer entered.", example: "0300 1234567" },
  { key: "customer_email", label: "Customer email", description: "The customer's email address, if given.", example: "ali@example.com" },
  { key: "store_name", label: "Store name", description: "Your Store's name.", example: "Your Store" },
  { key: "order_number", label: "Order number", description: "The order's tracking id.", example: "ORD-261006-AB12CD" },
  { key: "order_date", label: "Order date", description: "The day the order was placed.", example: "6 Oct 2026" },
  { key: "order_status", label: "Order status", description: "Pending, Confirmed, Delivered or Canceled.", example: "Pending" },
  { key: "payment_method", label: "Payment method", description: "How the customer pays.", example: "Cash on Delivery" },
  { key: "items", label: "Items", description: "One line per product with size, color and quantity (up to 10 lines, then a count of the rest).", example: "• Cotton Kurta (M, Blue) × 1\n• Leather Wallet (Brown) × 1\n• Lawn Dupatta × 1" },
  { key: "item_count", label: "Item count", description: "Total number of items ordered (quantities added up).", example: "3" },
  { key: "subtotal", label: "Subtotal", description: "The items' total, before anything else.", example: "Rs 4,500" },
  { key: "total", label: "Total", description: "The order total the customer pays.", example: "Rs 4,500" },
  { key: "address", label: "Address", description: "Address line 1 (house, street).", example: "House 12, Street 5, Gulberg" },
  { key: "address_line2", label: "Address line 2", description: "Apartment, landmark or area, if given.", example: "Near Main Market" },
  { key: "city", label: "City", description: "The delivery city.", example: "Lahore" },
  { key: "postal_code", label: "Postal code", description: "The delivery postal code.", example: "54000" },
  { key: "country", label: "Country", description: "The delivery country.", example: "Pakistan" },
  { key: "full_address", label: "Full address", description: "Every address part that is filled in, joined with commas.", example: "House 12, Street 5, Gulberg, Near Main Market, Lahore, 54000, Pakistan" },
  { key: "delivery_notes", label: "Delivery notes", description: "The note the customer left for delivery, if any.", example: "Please call before arriving." },
  { key: "delivery_fee", label: "Delivery fee", description: "The order's delivery fee, e.g. Rs 200, or Free.", example: "Free" },
  { key: "delivery_days", label: "Delivery days", description: "Your delivery time from Settings → Delivery, e.g. 2–3.", example: "2–3" },
  { key: "sender_name", label: "Sender name", description: "Your sender name (Settings → Sender details).", example: "Your Store" },
  { key: "sender_phone", label: "Sender phone", description: "Your sender phone (Settings → Sender details).", example: "042 35761234" },
  { key: "sender_address", label: "Sender address", description: "Your sender address (Settings → Sender details).", example: "Shop 4, Liberty Market" },
  { key: "sender_city", label: "Sender city", description: "Your sender city (Settings → Sender details).", example: "Lahore" },
];

const KNOWN_KEYS = new Set(ORDER_TEMPLATE_VARIABLES.map((variable) => variable.key));

// Sample order for the Settings previews and the variable examples.
export const SAMPLE_ORDER: OrderTemplateData = {
  storeName: "Your Store",
  trackingId: "ORD-261006-AB12CD",
  createdAt: "2026-10-06T08:00:00.000Z",
  status: "DRAFT",
  paymentMethod: "COD",
  customerName: "Ali Raza",
  email: "ali@example.com",
  phone: "0300 1234567",
  addressLine1: "House 12, Street 5, Gulberg",
  addressLine2: "Near Main Market",
  city: "Lahore",
  postalCode: "54000",
  country: "PK",
  customerNotes: "Please call before arriving.",
  subtotal: 4500,
  total: 4500,
  items: [
    { name: "Cotton Kurta", size: "M", color: "Blue", quantity: 1 },
    { name: "Leather Wallet", size: null, color: "Brown", quantity: 1 },
    { name: "Lawn Dupatta", size: null, color: null, quantity: 1 },
  ],
  deliveryFee: "0",
  deliveryDays: "2–3",
  senderName: "Your Store",
  senderPhone: "042 35761234",
  senderAddress: "Shop 4, Liberty Market",
  senderCity: "Lahore",
};

const TOKEN = /\{([A-Za-z0-9_]+)\}/g;

export interface TemplateSegment {
  text: string;
  /** True for an unknown {token}, kept exactly as typed. */
  unknown: boolean;
}

// The rendered text as segments, so the Settings previews can highlight
// unknown tokens. A null or blank template falls back to `fallback`.
export function renderTemplateSegments(
  template: string | null | undefined,
  data: OrderTemplateData,
  fallback: string,
): TemplateSegment[] {
  const text = template && template.trim() ? template : fallback;
  const variables = resolveVariables(data);
  const segments: TemplateSegment[] = [];
  let last = 0;

  text.replace(TOKEN, (token: string, key: string, offset: number) => {
    if (offset > last) segments.push({ text: text.slice(last, offset), unknown: false });
    segments.push(
      KNOWN_KEYS.has(key)
        ? { text: variables[key] ?? "", unknown: false }
        : { text: token, unknown: true },
    );
    last = offset + token.length;
    return token;
  });

  if (last < text.length) segments.push({ text: text.slice(last), unknown: false });

  return segments;
}

// Fills known {variables}; an unknown {token} is left exactly as typed.
export function renderTemplate(
  template: string | null | undefined,
  data: OrderTemplateData,
  fallback: string,
): string {
  return renderTemplateSegments(template, data, fallback)
    .map((segment) => segment.text)
    .join("");
}

// Unknown {tokens} in a template, for the editor's soft hint only.
export function findUnknownPlaceholders(template: string): string[] {
  const unknown = new Set<string>();

  for (const match of Array.from(template.matchAll(TOKEN))) {
    if (!KNOWN_KEYS.has(match[1])) {
      unknown.add(match[0]);
    }
  }

  return Array.from(unknown);
}

// What to store for a template field: null (use the default) for blank text
// or text identical to the default; otherwise the trimmed text. Returns an
// error message for anything else invalid. Line endings are normalised to \n.
export function normalizeTemplateInput(
  value: unknown,
  fallback: string,
  { max, label = "Template" }: { max: number; label?: string },
): { error: string } | { value: string | null } {
  if (value === null) return { value: null };
  if (typeof value !== "string") return { error: `${label} must be text or null` };

  const text = value.replace(/\r\n?/g, "\n").trim();

  if (text === "" || text === fallback) return { value: null };
  if (text.length > max) {
    return { error: `${label} must be at most ${max} characters` };
  }

  return { value: text };
}
