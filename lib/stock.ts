// Low-stock alerts and the stock shoppers see. Pure rules shared by the
// merchant routes, the public product reads, the dashboard and the Settings /
// product forms. No Prisma import (usable client- and server-side).
//
// Every number shown is the real stock: there is no setting that shows a
// product as low when it isn't.

export const MIN_LOW_STOCK_THRESHOLD = 1;
export const MAX_LOW_STOCK_THRESHOLD = 1000;
export const DEFAULT_LOW_STOCK_THRESHOLD = 5;

export const LOW_STOCK_THRESHOLD_ERROR = "Low-stock threshold must be a whole number from 1 to 1000";

export type StockDisplayModeValue = "ALWAYS" | "WHEN_LOW" | "NEVER";

export const STOCK_DISPLAY_MODES: readonly { value: StockDisplayModeValue; label: string }[] = [
  { value: "ALWAYS", label: "Always show quantity" },
  { value: "WHEN_LOW", label: "Only when low" },
  { value: "NEVER", label: "Never" },
];

export const isStockDisplayMode = (value: unknown): value is StockDisplayModeValue =>
  STOCK_DISPLAY_MODES.some((mode) => mode.value === value);

// The Store's stock settings (also the merchant GET/PATCH response shape).
export type StockSettings = {
  lowStockThreshold: number;
  stockDisplayMode: StockDisplayModeValue;
};

export type StockProduct = {
  quantity: number;
  lowStockAlert: boolean;
  /** null = use the Store default. */
  lowStockThreshold: number | null;
};

// The column defaults (prisma/schema.prisma).
export const DEFAULT_STOCK_SETTINGS: StockSettings = {
  lowStockThreshold: DEFAULT_LOW_STOCK_THRESHOLD,
  stockDisplayMode: "WHEN_LOW",
};

// The only Store columns stock reads need (Store has Decimal columns, never load a full row).
export const STOCK_SETTINGS_SELECT = { lowStockThreshold: true, stockDisplayMode: true } as const;

export const toStockSettings = (store: StockSettings): StockSettings => ({
  lowStockThreshold: store.lowStockThreshold,
  stockDisplayMode: store.stockDisplayMode,
});

// A whole number 1–1000, as a JSON number or a digit string (trimmed).
export function parseLowStockThreshold(raw: unknown): { value: number } | { error: string } {
  const value =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && /^\d+$/.test(raw.trim())
        ? Number(raw.trim())
        : NaN;

  if (!Number.isInteger(value) || value < MIN_LOW_STOCK_THRESHOLD || value > MAX_LOW_STOCK_THRESHOLD) {
    return { error: LOW_STOCK_THRESHOLD_ERROR };
  }

  return { value };
}

// A product's override:
// - `undefined` (field missing) → { value: undefined }: POST means none,
//   PATCH means unchanged.
// - `null` / "" → { value: null }: use the Store default (PATCH clears it).
// - otherwise the threshold rule above.
export function parseProductLowStockThreshold(
  raw: unknown,
): { value: number | null | undefined } | { error: string } {
  if (raw === undefined) return { value: undefined };
  if (raw === null || (typeof raw === "string" && raw.trim() === "")) return { value: null };

  return parseLowStockThreshold(raw);
}

// A product's alert switch: omitted = undefined (POST: on, PATCH: unchanged).
export function parseLowStockAlert(raw: unknown): { value: boolean | undefined } | { error: string } {
  if (raw === undefined) return { value: undefined };
  if (typeof raw !== "boolean") return { error: "Invalid request body" };

  return { value: raw };
}

// Validates a merchant PATCH body { lowStockThreshold?, stockDisplayMode? }
// against the current settings, before any write. Omitted = unchanged.
export function parseStockSettingsPatch(
  body: unknown,
  current: StockSettings,
): { value: StockSettings } | { error: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { error: "Invalid request body" };
  }

  const raw = body as Record<string, unknown>;
  const next = { ...current };

  if (raw.lowStockThreshold !== undefined) {
    const threshold = parseLowStockThreshold(raw.lowStockThreshold);
    if ("error" in threshold) return threshold;
    next.lowStockThreshold = threshold.value;
  }

  if (raw.stockDisplayMode !== undefined) {
    if (!isStockDisplayMode(raw.stockDisplayMode)) return { error: "Invalid display mode" };
    next.stockDisplayMode = raw.stockDisplayMode;
  }

  return { value: next };
}

export const effectiveThreshold = (
  product: Pick<StockProduct, "lowStockThreshold">,
  store: Pick<StockSettings, "lowStockThreshold">,
) => product.lowStockThreshold ?? store.lowStockThreshold;

// Out of stock (0) counts as low.
export const isLowStock = (product: StockProduct, store: Pick<StockSettings, "lowStockThreshold">) =>
  product.lowStockAlert && product.quantity <= effectiveThreshold(product, store);

export type StockDisplay = { kind: "low"; quantity: number } | { kind: "count"; quantity: number };

// What the Storefront shows next to a product (the public `stockDisplay`):
// - out of stock (quantity ≤ 0) → null: the existing sold-out UI applies;
// - NEVER → null;
// - WHEN_LOW → "low" when isLowStock, else null;
// - ALWAYS → "low" when isLowStock, else "count".
// A product with its alert off is never "low"; in ALWAYS mode it still shows its count.
export function stockDisplay(product: StockProduct, store: StockSettings): StockDisplay | null {
  if (product.quantity <= 0 || store.stockDisplayMode === "NEVER") return null;

  if (isLowStock(product, store)) return { kind: "low", quantity: product.quantity };

  return store.stockDisplayMode === "ALWAYS" ? { kind: "count", quantity: product.quantity } : null;
}

// Shopper-facing wording (Settings examples; the Storefront uses the same).
export const stockDisplayText = (display: StockDisplay) =>
  display.kind === "low" ? `Only ${display.quantity} left` : `${display.quantity} in stock`;
