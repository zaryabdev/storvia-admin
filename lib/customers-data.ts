// Customers list loader (server). Rules: DECISIONS.md → Customers list.

import { Prisma } from "@prisma/client";

import { CUSTOMER_COMPARATORS, type CustomerRow } from "@/lib/customer-search";
import { groupCustomers, type CustomerGroup } from "@/lib/customers";
import { formatDate } from "@/lib/order-template";
import prismadb from "@/lib/prismadb";
import { orderTotalAmount } from "@/lib/store-sales";
import { formatter } from "@/lib/utils";
import { buildWhatsAppChatUrl, toWhatsAppNumber } from "@/lib/whatsapp-message";

const CUSTOMER_ORDER_SELECT = {
  id: true,
  trackingId: true,
  createdAt: true,
  status: true,
  paymentMethod: true,
  isPaid: true,
  paymentReceivedVia: true,
  total: true,
  currency: true,
  customerName: true,
  email: true,
  phone: true,
  orderItems: { select: { quantity: true, product: { select: { price: true } } } },
} satisfies Prisma.OrderSelect;

// Dense rank by total spent, highest first (0); equal totals share a rank.
// Compared as Decimals, so the client never sorts money strings or floats.
function spentRanks(groups: CustomerGroup[]): Map<string, number> {
  const ranks = new Map<string, number>();
  let rank = -1;
  let previous: CustomerGroup["totalSpent"] | null = null;

  for (const group of groups.slice().sort((a, b) => b.totalSpent.comparedTo(a.totalSpent))) {
    if (previous === null || !group.totalSpent.equals(previous)) {
      rank += 1;
      previous = group.totalSpent;
    }
    ranks.set(group.key, rank);
  }

  return ranks;
}

// What the phone search matches: both forms of a Pakistani mobile, else the digits.
const searchDigits = (key: string) =>
  key.startsWith("pk:") ? `${key.slice(3)} 0${key.slice(5)}` : key.slice(2);

function toCustomerRow(group: CustomerGroup, spentRank: number, blockedPhoneId: string | null): CustomerRow {
  const whatsappNumber = toWhatsAppNumber(group.phone);

  return {
    id: group.key,
    name: group.name ?? "No name",
    hasName: group.name !== null,
    email: group.email,
    phone: group.phone,
    searchDigits: searchDigits(group.key),
    orderCount: group.orderCount,
    // Display strings only (Decimals never reach the client).
    totalSpent: formatter.format(group.totalSpent.toNumber()),
    spentRank,
    lastOrderDate: formatDate(group.lastOrderAt),
    lastOrderAt: group.lastOrderAt.getTime(),
    whatsappUrl: whatsappNumber ? buildWhatsAppChatUrl(whatsappNumber) : null,
    blockedPhoneId,
    orders: group.orders.map((order) => ({
      id: order.id,
      trackingId: order.trackingId,
      date: formatDate(order.createdAt),
      status: order.status,
      paymentMethod: order.paymentMethod,
      isPaid: order.isPaid,
      paymentReceivedVia: order.paymentReceivedVia,
      total: formatter.format(orderTotalAmount(order).toNumber()),
    })),
  };
}

/**
 * The Store's customers, newest last order first. Assumes the caller has
 * already checked that the signed-in user owns the Store. `blockedIdByKey`
 * maps the Store's blocked phone keys to their row ids (a blocked key equals
 * the customer key of that mobile).
 */
export async function loadStoreCustomers(
  storeId: string,
  blockedIdByKey: Map<string, string>
): Promise<CustomerRow[]> {
  const orders = await prismadb.order.findMany({
    where: { storeId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: CUSTOMER_ORDER_SELECT,
  });

  const groups = groupCustomers(orders, storeId);
  const ranks = spentRanks(groups);

  return groups
    .map((group) => toCustomerRow(group, ranks.get(group.key) ?? 0, blockedIdByKey.get(group.key) ?? null))
    .sort(CUSTOMER_COMPARATORS.lastOrder);
}
