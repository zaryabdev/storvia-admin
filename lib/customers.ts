// Customers list: customers derived from orders, grouped by phone. Server-only
// (Decimal amounts); it never queries the database itself (lib/customers-data.ts
// does). Rules: DECISIONS.md → Customers list. Grouping runs in code; move it
// to the database once Stores reach thousands of orders.

import type { OrderStatus, PaymentMethod, PaymentReceivedVia } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

import { PreciseDecimal } from "@/lib/decimal";
import { toPakistaniMobile } from "@/lib/phone";
import { SALES_STATUSES, orderSalesAmount } from "@/lib/store-sales";

// The order fields grouping reads (lib/customers-data.ts selects exactly these).
export type CustomerSourceOrder = {
  id: string;
  trackingId: string;
  createdAt: Date;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  isPaid: boolean;
  paymentReceivedVia: PaymentReceivedVia | null;
  total: Decimal | null;
  currency: string | null;
  customerName: string;
  email: string;
  phone: string;
  orderItems: Array<{ quantity: number; product: { price: Decimal } }>;
};

export type CustomerGroup = {
  key: string;
  /** The newest non-blank name / email (trimmed), or null. */
  name: string | null;
  email: string | null;
  /** The newest order's phone, as stored. */
  phone: string;
  /** All statuses. */
  orderCount: number;
  /** Sum of orderSalesAmount: CONFIRMED + DELIVERED in PKR (the sales rule). */
  totalSpent: Decimal;
  /** The newest order's createdAt, any status. */
  lastOrderAt: Date;
  /** Per status; kept for the "Customer history on orders" feature, never sent to the client. */
  statusCounts: Record<OrderStatus, number>;
  /** Newest first. */
  orders: CustomerSourceOrder[];
};

// The grouping key: "pk:" + the 92… form for a Pakistani mobile (so 0300…,
// +92 300… and 92300… are one customer), otherwise "d:" + the digits. A blank
// phone or one without digits has no key: its orders belong to no customer.
export function customerKey(phone: string | null | undefined): string | null {
  const trimmed = typeof phone === "string" ? phone.trim() : "";

  const mobile = toPakistaniMobile(trimmed);
  if (mobile) return `pk:${mobile}`;

  const digits = trimmed.replace(/\D/g, "");
  return digits ? `d:${digits}` : null;
}

// Newest first; the id breaks ties, like the query's orderBy.
const newestFirst = (a: CustomerSourceOrder, b: CustomerSourceOrder) =>
  b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);

const newestNonBlank = (values: string[]) =>
  values.map((value) => value.trim()).find((value) => value !== "") ?? null;

/**
 * Groups a Store's orders by customerKey, newest customer first. Eligible
 * orders in a currency other than PKR are left out of totalSpent (like the
 * dashboard) and logged once per call, counts only.
 */
export function groupCustomers(orders: CustomerSourceOrder[], storeId: string): CustomerGroup[] {
  const byKey = new Map<string, CustomerSourceOrder[]>();

  for (const order of orders.slice().sort(newestFirst)) {
    const key = customerKey(order.phone);
    if (!key) continue;

    const customerOrders = byKey.get(key);
    if (customerOrders) customerOrders.push(order);
    else byKey.set(key, [order]);
  }

  let otherCurrencyOrders = 0;
  const otherCurrencies = new Set<string>();

  const groups = Array.from(byKey, ([key, customerOrders]): CustomerGroup => {
    const statusCounts: Record<OrderStatus, number> = {
      DRAFT: 0,
      CONFIRMED: 0,
      DELIVERED: 0,
      CANCELED: 0,
    };
    let totalSpent = new PreciseDecimal(0) as Decimal;

    for (const order of customerOrders) {
      statusCounts[order.status] += 1;

      const amount = orderSalesAmount(order);
      if (amount) {
        totalSpent = totalSpent.plus(amount);
      } else if ((SALES_STATUSES as readonly string[]).includes(order.status)) {
        // Eligible but not counted: the currency isn't PKR.
        otherCurrencyOrders += 1;
        otherCurrencies.add(order.currency ?? "");
      }
    }

    return {
      key,
      name: newestNonBlank(customerOrders.map((order) => order.customerName)),
      email: newestNonBlank(customerOrders.map((order) => order.email)),
      phone: customerOrders[0].phone,
      orderCount: customerOrders.length,
      totalSpent,
      lastOrderAt: customerOrders[0].createdAt,
      statusCounts,
      orders: customerOrders,
    };
  });

  if (otherCurrencyOrders > 0) {
    console.error(
      `[CUSTOMERS] Store ${storeId}: ${otherCurrencyOrders} eligible orders in ` +
        `${Array.from(otherCurrencies).join(", ")} are excluded from customers' total spent (PKR).`
    );
  }

  return groups;
}
