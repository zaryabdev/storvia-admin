import prismadb from "@/lib/prismadb";
import {
  DEFAULT_STOCK_SETTINGS,
  MAX_LOW_STOCK_THRESHOLD,
  STOCK_SETTINGS_SELECT,
  effectiveThreshold,
  isLowStock,
} from "@/lib/stock";

export const LOW_STOCK_CARD_LIMIT = 10;

export type LowStockProduct = {
  id: string;
  name: string;
  quantity: number;
  threshold: number;
};

// Non-archived products with the alert on that are at or below their
// threshold: out of stock first, then lowest quantity, then name. Plain values
// only. `total` counts every low product; `products` holds the first 10.
export const getLowStockProducts = async (storeId: string) => {
  const [store, candidates] = await Promise.all([
    prismadb.store.findUnique({ where: { id: storeId }, select: STOCK_SETTINGS_SELECT }),
    prismadb.product.findMany({
      where: {
        storeId,
        isArchived: false,
        lowStockAlert: true,
        // No threshold can be higher, so nothing above it is ever low.
        quantity: { lte: MAX_LOW_STOCK_THRESHOLD },
      },
      select: { id: true, name: true, quantity: true, lowStockAlert: true, lowStockThreshold: true },
    }),
  ]);

  const settings = store ?? DEFAULT_STOCK_SETTINGS;

  const low: LowStockProduct[] = candidates
    .filter((product) => isLowStock(product, settings))
    .map((product) => ({
      id: product.id,
      name: product.name,
      quantity: product.quantity,
      threshold: effectiveThreshold(product, settings),
    }))
    .sort((a, b) => a.quantity - b.quantity || a.name.localeCompare(b.name));

  return { products: low.slice(0, LOW_STOCK_CARD_LIMIT), total: low.length };
};
