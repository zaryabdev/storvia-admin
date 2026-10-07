// Packing slips: the printable slip's settings rules and its view model. Pure
// functions, no React or Prisma. Templates use the shared order-template
// engine (lib/order-template.ts), including the sender variables.

import {
  formatDate,
  formatMoney,
  normalizeTemplateInput,
  renderTemplate,
  type OrderTemplateData,
} from "./order-template";
import { isSenderDetailsComplete } from "./sender-details";

export const SLIP_PAPER_SIZES = ["A5", "A4"] as const;
export type SlipPaperSizeValue = (typeof SLIP_PAPER_SIZES)[number];
export const DEFAULT_SLIP_PAPER_SIZE: SlipPaperSizeValue = "A5";

export const MAX_SLIP_TEMPLATE_LENGTH = 500;

export const DEFAULT_SLIP_HEADER_TEMPLATE = "";
export const DEFAULT_SLIP_FOOTER_TEMPLATE =
  "Shukriya {customer_name}! {store_name} se khareedari ka shukriya. Koi masla ho to {sender_phone} par rabta karein.";

export const isSlipPaperSize = (value: unknown): value is SlipPaperSizeValue =>
  typeof value === "string" && (SLIP_PAPER_SIZES as readonly string[]).includes(value);

// What to store for a slip template: null (use the default) for blank text or
// text identical to the default; otherwise the trimmed text, at most 500
// characters. Unknown {placeholders} are accepted.
export function normalizeSlipTemplateInput(
  value: unknown,
  fallback: string,
  label: string,
): { error: string } | { value: string | null } {
  return normalizeTemplateInput(value, fallback, { max: MAX_SLIP_TEMPLATE_LENGTH, label });
}

export interface PackingSlipItemInput {
  name: string;
  size?: string | null;
  color?: string | null;
  quantity: number;
  /** Resolved by the loader (snapshot, else the live price); null if unknown. */
  unitPrice: number | null;
  lineTotal: number | null;
}

export type PackingSlipOrder = Omit<
  OrderTemplateData,
  "storeName" | "items" | "senderName" | "senderPhone" | "senderAddress" | "senderCity"
> & { items: PackingSlipItemInput[] };

export interface PackingSlipStore {
  name: string;
  logoUrl: string | null;
  senderName: string | null;
  senderPhone: string | null;
  senderAddress: string | null;
  senderCity: string | null;
  slipPaperSize: string;
  slipHeaderTemplate: string | null;
  slipFooterTemplate: string | null;
}

export type PackingSlipBanner = "NOT CONFIRMED" | "CANCELED" | null;

export interface PackingSlipModel {
  paperSize: SlipPaperSizeValue;
  /** True when any sender field is missing: the page shows the gate, no slip. */
  senderIncomplete: boolean;
  banner: PackingSlipBanner;
  storeName: string;
  logoUrl: string | null;
  orderNumber: string;
  orderDate: string;
  /** Rendered header note; "" = not shown. */
  headerText: string;
  /** Rendered footer message; "" = not shown. */
  footerText: string;
  from: { name: string; phone: string; address: string; city: string };
  shipTo: { name: string; phone: string; lines: string[] };
  showPrices: boolean;
  /** Every item (no cap). unitPrice/lineTotal only when prices are shown. */
  items: Array<{
    name: string;
    /** "M · Blue", "" when neither is set. */
    options: string;
    quantity: number;
    unitPrice?: string;
    lineTotal?: string;
  }>;
  /** null when prices are hidden. */
  totals: { subtotal: string; total: string } | null;
  /** Always present: COD shows the amount, any other method shows prepaid. */
  amountToCollect:
    | { kind: "cod"; label: "AMOUNT TO COLLECT (COD)"; amount: string }
    | { kind: "prepaid"; label: "PREPAID: nothing to collect" };
  notes: string;
}

const clean = (value: string | null | undefined) => (value ?? "").trim();

export function buildPackingSlipModel(
  order: PackingSlipOrder,
  store: PackingSlipStore,
  { showPrices }: { showPrices: boolean },
): PackingSlipModel {
  const templateData: OrderTemplateData = {
    ...order,
    storeName: store.name,
    items: order.items.map(({ name, size, color, quantity }) => ({ name, size, color, quantity })),
    senderName: store.senderName,
    senderPhone: store.senderPhone,
    senderAddress: store.senderAddress,
    senderCity: store.senderCity,
  };

  const structured = [order.addressLine1, order.addressLine2, order.city, order.postalCode].some(
    (part) => clean(part),
  );
  const shipLines = structured
    ? [
        clean(order.addressLine1),
        clean(order.addressLine2),
        [clean(order.city), clean(order.postalCode)].filter(Boolean).join(" "),
      ].filter(Boolean)
    : [clean(order.legacyAddress)].filter(Boolean);

  const total = formatMoney(order.total);

  return {
    paperSize: isSlipPaperSize(store.slipPaperSize) ? store.slipPaperSize : DEFAULT_SLIP_PAPER_SIZE,
    senderIncomplete: !isSenderDetailsComplete(store),
    banner: order.status === "DRAFT" ? "NOT CONFIRMED" : order.status === "CANCELED" ? "CANCELED" : null,
    storeName: store.name,
    logoUrl: clean(store.logoUrl) || null,
    orderNumber: order.trackingId,
    orderDate: formatDate(order.createdAt),
    headerText: renderTemplate(store.slipHeaderTemplate, templateData, DEFAULT_SLIP_HEADER_TEMPLATE).trim(),
    footerText: renderTemplate(store.slipFooterTemplate, templateData, DEFAULT_SLIP_FOOTER_TEMPLATE).trim(),
    from: {
      name: clean(store.senderName),
      phone: clean(store.senderPhone),
      address: clean(store.senderAddress),
      city: clean(store.senderCity),
    },
    shipTo: { name: clean(order.customerName), phone: clean(order.phone), lines: shipLines },
    showPrices,
    items: order.items.map((item) => ({
      name: item.name,
      options: [item.size, item.color].map(clean).filter(Boolean).join(" · "),
      quantity: item.quantity,
      ...(showPrices
        ? { unitPrice: formatMoney(item.unitPrice), lineTotal: formatMoney(item.lineTotal) }
        : {}),
    })),
    totals: showPrices ? { subtotal: formatMoney(order.subtotal), total } : null,
    amountToCollect:
      order.paymentMethod === "COD"
        ? { kind: "cod", label: "AMOUNT TO COLLECT (COD)", amount: total }
        : { kind: "prepaid", label: "PREPAID: nothing to collect" },
    notes: clean(order.customerNotes),
  };
}
