// Customers list: the row shape sent to the page, search and sorts. A plain,
// client-safe module (no Prisma, no Decimal, no server imports): the page
// searches, sorts and pages in client state only, so phones never go in a URL.
// Rules: DECISIONS.md → Customers list.

import { toPakistaniMobile } from "./phone";

export type CustomerOrderRow = {
  id: string;
  trackingId: string;
  /** "6 Oct 2026", Pakistan time. */
  date: string;
  status: string;
  paymentMethod: string;
  isPaid: boolean;
  paymentReceivedVia: string | null;
  /** "Rs 4,500": the order total (snapshot, or the legacy fallback), any status. */
  total: string;
};

// Display strings and plain numbers only: this crosses to Client Components.
export type CustomerRow = {
  /** The grouping key ("pk:923001234567" or "d:0425551234"). Never put it in a URL. */
  id: string;
  /** The newest non-blank name, or "No name" (hasName false). */
  name: string;
  hasName: boolean;
  /** The newest non-blank email, or null. */
  email: string | null;
  /** The newest order's phone, as stored. */
  phone: string;
  /**
   * Digits the phone search matches against: for a Pakistani mobile both the
   * 92… and the 03… form ("923001234567 03001234567"), otherwise the digits.
   */
  searchDigits: string;
  /** All statuses. */
  orderCount: number;
  /** "Rs 4,500": CONFIRMED + DELIVERED in PKR (the sales rule). */
  totalSpent: string;
  /** 0 = the highest total spent; equal totals share a rank. */
  spentRank: number;
  /** "6 Oct 2026": the newest order of any status. */
  lastOrderDate: string;
  /** Milliseconds since the epoch, for sorting. */
  lastOrderAt: number;
  /** wa.me chat link with no text; null when the phone isn't a Pakistani mobile. */
  whatsappUrl: string | null;
  /** The customer's row on the Store's blocklist, or null when not blocked. */
  blockedPhoneId: string | null;
  /** Newest first. */
  orders: CustomerOrderRow[];
};

export const MIN_PHONE_QUERY_DIGITS = 3;

// Name: case-insensitive substring. Phone: a query that is a Pakistani mobile
// matches that customer exactly; otherwise its digits (at least 3) match as a
// substring. A blank query matches everyone.
export function matchesCustomerQuery(row: CustomerRow, query: string): boolean {
  const q = query.trim();
  if (!q) return true;

  if (row.hasName && row.name.toLowerCase().includes(q.toLowerCase())) return true;

  const mobile = toPakistaniMobile(q);
  if (mobile) return row.id === `pk:${mobile}`;

  const digits = q.replace(/\D/g, "");
  return digits.length >= MIN_PHONE_QUERY_DIGITS && row.searchDigits.includes(digits);
}

export type CustomerSort = "lastOrder" | "totalSpent" | "orderCount";

export const DEFAULT_CUSTOMER_SORT: CustomerSort = "lastOrder";

type CustomerOrderFields = Pick<CustomerRow, "id" | "lastOrderAt" | "spentRank" | "orderCount">;

// Tie-break for every sort: last order (newest first), then the key.
const byLastOrderThenKey = (a: CustomerOrderFields, b: CustomerOrderFields) =>
  b.lastOrderAt - a.lastOrderAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export const CUSTOMER_COMPARATORS: Record<
  CustomerSort,
  (a: CustomerOrderFields, b: CustomerOrderFields) => number
> = {
  lastOrder: byLastOrderThenKey,
  totalSpent: (a, b) => a.spentRank - b.spentRank || byLastOrderThenKey(a, b),
  orderCount: (a, b) => b.orderCount - a.orderCount || byLastOrderThenKey(a, b),
};
