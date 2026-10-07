import { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

import { PreciseDecimal } from "@/lib/decimal";
import prismadb from "@/lib/prismadb";

// The single implementation of the sales rule, used by the merchant dashboard
// and the Super Admin routes — see DECISIONS.md "Sales metrics":
//  - eligible orders: this Store's CONFIRMED + DELIVERED orders; isPaid is
//    never used (COD never sets it);
//  - amount: the stored Order.total snapshot; only legacy orders with a NULL
//    total fall back to Product.price x OrderItem.quantity;
//  - Decimal arithmetic only; a NULL currency is PKR.
//
// The dashboard formats every amount as PKR, so amounts in any other currency
// are never summed into it: they are left out and logged server-side, and the
// page keeps rendering. Every order is PKR today (COD snapshots PKR).

export const SALES_STATUSES = ["CONFIRMED", "DELIVERED"] as const;
export const DASHBOARD_CURRENCY = "PKR";

const salesOrderWhere = (storeId: string) =>
  ({
    storeId,
    status: { in: [...SALES_STATUSES] },
  }) satisfies Prisma.OrderWhereInput;

const isDashboardCurrency = (currency: string | null) =>
  (currency ?? DASHBOARD_CURRENCY) === DASHBOARD_CURRENCY;

function warnOtherCurrencies(storeId: string, currencies: Set<string>) {
  if (currencies.size > 0) {
    console.error(
      `[STORE_SALES] Store ${storeId} has eligible orders in ${Array.from(currencies).join(", ")}; ` +
        `they are excluded from the ${DASHBOARD_CURRENCY} dashboard metrics.`
    );
  }
}

const legacyOrderTotal = (
  orderItems: Array<{ quantity: number; product: { price: Decimal } }>
): Decimal =>
  orderItems.reduce(
    (sum, item) => sum.plus(new PreciseDecimal(item.product.price).times(item.quantity)),
    new PreciseDecimal(0) as Decimal
  );

const legacyOrderSelect = {
  currency: true,
  createdAt: true,
  orderItems: {
    select: { quantity: true, product: { select: { price: true } } },
  },
} satisfies Prisma.OrderSelect;

/** Number of eligible orders (CONFIRMED + DELIVERED). */
export async function getStoreSalesCount(storeId: string): Promise<number> {
  return prismadb.order.count({ where: salesOrderWhere(storeId) });
}

type SnapshotGroup = { storeId: string; currency: string | null; total: Decimal | null };
type LegacySalesOrder = {
  storeId: string;
  currency: string | null;
  orderItems: Array<{ quantity: number; product: { price: Decimal } }>;
};

/** storeId -> currency -> exact total. A NULL currency is PKR. */
export type SalesByStore = Map<string, Map<string, Decimal>>;

/**
 * Pure aggregation: snapshot totals (already summed per Store + currency) plus
 * legacy orders (NULL total, priced from the Products).
 */
export function aggregateSales(
  snapshotGroups: SnapshotGroup[],
  legacyOrders: LegacySalesOrder[]
): SalesByStore {
  const byStore: SalesByStore = new Map();

  const add = (storeId: string, currency: string | null, amount: Decimal) => {
    const code = currency ?? DASHBOARD_CURRENCY;
    let byCurrency = byStore.get(storeId);
    if (!byCurrency) {
      byCurrency = new Map();
      byStore.set(storeId, byCurrency);
    }
    byCurrency.set(code, (byCurrency.get(code) ?? new PreciseDecimal(0)).plus(amount));
  };

  for (const group of snapshotGroups) {
    add(group.storeId, group.currency, new PreciseDecimal(group.total ?? 0));
  }

  for (const order of legacyOrders) {
    add(order.storeId, order.currency, legacyOrderTotal(order.orderItems));
  }

  return byStore;
}

/**
 * Per-Store, per-currency sales totals of eligible orders. Always two queries,
 * however many Stores: pass `storeIds` to restrict, omit for every Store.
 */
export async function getSalesByStore(storeIds?: string[]): Promise<SalesByStore> {
  const where = {
    status: { in: [...SALES_STATUSES] },
    ...(storeIds && { storeId: { in: storeIds } }),
  } satisfies Prisma.OrderWhereInput;

  const [snapshotGroups, legacyOrders] = await Promise.all([
    prismadb.order.groupBy({
      by: ["storeId", "currency"],
      where: { ...where, total: { not: null } },
      _sum: { total: true },
    }),
    prismadb.order.findMany({
      where: { ...where, total: null },
      select: {
        storeId: true,
        currency: true,
        orderItems: { select: { quantity: true, product: { select: { price: true } } } },
      },
    }),
  ]);

  return aggregateSales(
    snapshotGroups.map((g) => ({ storeId: g.storeId, currency: g.currency, total: g._sum.total })),
    legacyOrders
  );
}

/** One Store's per-currency sales totals (empty when it has no eligible orders). */
export async function getStoreSalesByCurrency(storeId: string): Promise<Map<string, Decimal>> {
  return (await getSalesByStore([storeId])).get(storeId) ?? new Map();
}

/**
 * Super Admin currency policy: a Store's sales are in one currency (PKR with
 * zero sales when it has none); more than one throws, never summed.
 */
export function singleCurrencySales(
  storeId: string,
  byCurrency: Map<string, Decimal> | undefined
): { currency: string; total: Decimal } {
  if (byCurrency && byCurrency.size > 1) {
    throw new Error(
      `Mixed currencies in store ${storeId}: ${Array.from(byCurrency.keys()).join(", ")}`
    );
  }

  const [currency, total] = byCurrency?.size
    ? Array.from(byCurrency.entries())[0]
    : [DASHBOARD_CURRENCY, new PreciseDecimal(0) as Decimal];

  return { currency, total };
}

/** Dashboard currency policy: PKR only; other currencies are excluded and logged. */
export function dashboardSales(storeId: string, byCurrency: Map<string, Decimal>): Decimal {
  const otherCurrencies = new Set(
    Array.from(byCurrency.keys()).filter((currency) => currency !== DASHBOARD_CURRENCY)
  );

  warnOtherCurrencies(storeId, otherCurrencies);

  return byCurrency.get(DASHBOARD_CURRENCY) ?? new PreciseDecimal(0);
}

/** Exact PKR sales total of the Store's eligible orders. */
export async function getStoreSalesTotal(storeId: string): Promise<Decimal> {
  return dashboardSales(storeId, await getStoreSalesByCurrency(storeId));
}

/**
 * Legacy fallback totals (Product.price x OrderItem.quantity) for the given
 * orders, in one query. Orders without items are missing from the map.
 */
export async function getLegacyOrderTotals(orderIds: string[]): Promise<Map<string, Decimal>> {
  if (orderIds.length === 0) {
    return new Map();
  }

  const items = await prismadb.orderItem.findMany({
    where: { orderId: { in: orderIds } },
    select: { orderId: true, quantity: true, product: { select: { price: true } } },
  });

  const byOrder = new Map<string, typeof items>();
  for (const item of items) {
    byOrder.set(item.orderId, [...(byOrder.get(item.orderId) ?? []), item]);
  }

  return new Map(Array.from(byOrder, ([orderId, lines]) => [orderId, legacyOrderTotal(lines)]));
}

export const GRAPH_MONTHS = 12;

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** UTC window of the revenue graph: the last 12 calendar months ending with `now`'s month. */
export function getGraphWindow(now: Date): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (GRAPH_MONTHS - 1), 1)),
    end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
  };
}

/**
 * Buckets orders into exactly 12 chronological UTC months ending with `now`'s
 * month, zero-filled, labelled like "Jan 26". Orders outside the window are
 * ignored. `date` is Order.confirmedAt, or createdAt for legacy orders.
 */
export function bucketMonthlyRevenue(
  orders: Array<{ date: Date; amount: Decimal }>,
  now: Date
): Array<{ name: string; total: number }> {
  const { start } = getGraphWindow(now);
  const totals: Decimal[] = Array.from({ length: GRAPH_MONTHS }, () => new PreciseDecimal(0) as Decimal);

  for (const order of orders) {
    const index =
      (order.date.getUTCFullYear() - start.getUTCFullYear()) * 12 +
      (order.date.getUTCMonth() - start.getUTCMonth());

    if (index >= 0 && index < GRAPH_MONTHS) {
      totals[index] = totals[index].plus(order.amount);
    }
  }

  return totals.map((total, i) => {
    const month = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
    const year = String(month.getUTCFullYear()).slice(-2);
    return { name: `${MONTH_NAMES[month.getUTCMonth()]} ${year}`, total: total.toNumber() };
  });
}

/**
 * Eligible PKR orders dated inside [start, end) with their exact amounts. The
 * date is confirmedAt, or createdAt only when confirmedAt is null (legacy).
 */
export async function getStoreSalesOrders(
  storeId: string,
  start: Date,
  end: Date
): Promise<Array<{ date: Date; amount: Decimal }>> {
  const where = {
    ...salesOrderWhere(storeId),
    OR: [
      { confirmedAt: { gte: start, lt: end } },
      { confirmedAt: null, createdAt: { gte: start, lt: end } },
    ],
  } satisfies Prisma.OrderWhereInput;

  const [snapshotOrders, legacyOrders] = await Promise.all([
    prismadb.order.findMany({
      where: { ...where, total: { not: null } },
      select: { currency: true, createdAt: true, confirmedAt: true, total: true },
    }),
    prismadb.order.findMany({
      where: { ...where, total: null },
      select: { ...legacyOrderSelect, confirmedAt: true },
    }),
  ]);

  const orders: Array<{ date: Date; amount: Decimal }> = [];
  const otherCurrencies = new Set<string>();

  for (const order of snapshotOrders) {
    if (!isDashboardCurrency(order.currency)) {
      otherCurrencies.add(order.currency!);
      continue;
    }
    orders.push({
      date: order.confirmedAt ?? order.createdAt,
      amount: new PreciseDecimal(order.total!),
    });
  }

  for (const order of legacyOrders) {
    if (!isDashboardCurrency(order.currency)) {
      otherCurrencies.add(order.currency!);
      continue;
    }
    orders.push({
      date: order.confirmedAt ?? order.createdAt,
      amount: legacyOrderTotal(order.orderItems),
    });
  }

  warnOtherCurrencies(storeId, otherCurrencies);

  return orders;
}

/**
 * "Delivery fees collected": per Store, the exact sum of Order.deliveryFee over
 * the same eligible orders as sales (CONFIRMED + DELIVERED), in PKR (a NULL
 * currency is PKR). Legacy orders (NULL deliveryFee) add nothing. One grouped
 * query for any number of Stores; Stores without fees are absent (= 0).
 */
export async function getDeliveryFeesByStore(storeIds?: string[]): Promise<Map<string, Decimal>> {
  const groups = await prismadb.order.groupBy({
    by: ["storeId"],
    where: {
      status: { in: [...SALES_STATUSES] },
      ...(storeIds && { storeId: { in: storeIds } }),
      deliveryFee: { not: null },
      OR: [{ currency: null }, { currency: DASHBOARD_CURRENCY }],
    },
    _sum: { deliveryFee: true },
  });

  return new Map(
    groups.map((g) => [g.storeId, new PreciseDecimal(g._sum.deliveryFee ?? 0) as Decimal])
  );
}

/** One Store's delivery fees collected (exact PKR; 0 when none). */
export async function getStoreDeliveryFeesTotal(storeId: string): Promise<Decimal> {
  return (await getDeliveryFeesByStore([storeId])).get(storeId) ?? (new PreciseDecimal(0) as Decimal);
}
