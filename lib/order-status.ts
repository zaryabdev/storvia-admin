// Plain words for an order's status. Display only: data, APIs, URLs and logs
// keep the raw OrderStatus enum. Plain module (no Prisma, no React) so server
// and client code can both import it. Also feeds {order_status} in
// lib/order-template.ts.

export const ORDER_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Pending",
  CONFIRMED: "Confirmed",
  DELIVERED: "Delivered",
  CANCELED: "Canceled",
};

// An unknown value is returned as-is.
export const orderStatusLabel = (status: string): string =>
  Object.prototype.hasOwnProperty.call(ORDER_STATUS_LABELS, status)
    ? ORDER_STATUS_LABELS[status]
    : status;
