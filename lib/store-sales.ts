import { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

import { PreciseDecimal } from "@/lib/decimal";
import prismadb from "@/lib/prismadb";

// Merchant dashboard sales metrics. Same semantics as Super Admin salesTotal
// (app/api/super-admin/stores/route.ts) — see DECISIONS.md "Sales metrics":
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

/** Exact PKR sales total of the Store's eligible orders. */
export async function getStoreSalesTotal(storeId: string): Promise<Decimal> {
  const where = salesOrderWhere(storeId);

  const [snapshotGroups, legacyOrders] = await Promise.all([
    prismadb.order.groupBy({
      by: ["currency"],
      where: { ...where, total: { not: null } },
      _sum: { total: true },
    }),
    prismadb.order.findMany({
      where: { ...where, total: null },
      select: legacyOrderSelect,
    }),
  ]);

  let total: Decimal = new PreciseDecimal(0);
  const otherCurrencies = new Set<string>();

  for (const group of snapshotGroups) {
    if (!isDashboardCurrency(group.currency)) {
      otherCurrencies.add(group.currency!);
      continue;
    }
    total = total.plus(new PreciseDecimal(group._sum.total ?? 0));
  }

  for (const order of legacyOrders) {
    if (!isDashboardCurrency(order.currency)) {
      otherCurrencies.add(order.currency!);
      continue;
    }
    total = total.plus(legacyOrderTotal(order.orderItems));
  }

  warnOtherCurrencies(storeId, otherCurrencies);

  return total;
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
