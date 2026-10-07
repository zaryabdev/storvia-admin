// Loads what the packing-slip page needs, Store-scoped: the Store must be the
// signed-in user's, and the order is read with findFirst({ id, storeId }), so
// another Store's order behaves like a missing one.

import { PreciseDecimal } from "./decimal";
import type { PackingSlipOrder, PackingSlipStore } from "./packing-slip";
import prismadb from "./prismadb";

export type PackingSlipData =
  | { status: "store-not-found" }
  | { status: "order-not-found" }
  | { status: "ok"; order: PackingSlipOrder; store: PackingSlipStore };

export async function loadPackingSlipData({
  storeId,
  orderId,
  userId,
}: {
  storeId: string;
  orderId: string;
  userId: string;
}): Promise<PackingSlipData> {
  const store = await prismadb.store.findFirst({
    where: { id: storeId, userId },
    select: {
      name: true,
      logoUrl: true,
      senderName: true,
      senderPhone: true,
      senderAddress: true,
      senderCity: true,
      slipPaperSize: true,
      slipHeaderTemplate: true,
      slipFooterTemplate: true,
      deliveryDaysMin: true,
      deliveryDaysMax: true,
    },
  });

  if (!store) return { status: "store-not-found" };

  const order = await prismadb.order.findFirst({
    where: { id: orderId, storeId },
    include: {
      orderItems: {
        include: { product: { include: { size: true, color: true } } },
      },
    },
  });

  if (!order) return { status: "order-not-found" };

  // Snapshot money where present; legacy rows fall back to the live price
  // (same display fallback as the orders page), summed with PreciseDecimal.
  const lines = order.orderItems.map((oi) => {
    const unit = new PreciseDecimal((oi.unitPrice ?? oi.product.price).toString());
    const line = oi.lineTotal != null ? new PreciseDecimal(oi.lineTotal.toString()) : unit.times(oi.quantity);

    return { oi, unit, line };
  });
  const itemsSum = lines.reduce((sum, { line }) => sum.plus(line), new PreciseDecimal(0));
  const subtotal = order.subtotal != null ? new PreciseDecimal(order.subtotal.toString()) : itemsSum;
  // Snapshot total already includes delivery; a legacy order has neither.
  const total = order.total != null ? new PreciseDecimal(order.total.toString()) : subtotal;

  return {
    status: "ok",
    store,
    order: {
      trackingId: order.trackingId,
      createdAt: order.createdAt,
      status: order.status,
      paymentMethod: order.paymentMethod,
      customerName: order.customerName ?? "",
      email: order.email ?? "",
      phone: order.phone ?? "",
      addressLine1: order.addressLine1 ?? "",
      addressLine2: order.addressLine2 ?? "",
      city: order.city ?? "",
      postalCode: order.postalCode ?? "",
      country: order.country ?? "PK",
      legacyAddress: order.address ?? "",
      customerNotes: order.customerNotes ?? "",
      subtotal: subtotal.toNumber(),
      deliveryFee: order.deliveryFee != null ? new PreciseDecimal(order.deliveryFee.toString()).toFixed() : null,
      total: total.toNumber(),
      items: lines.map(({ oi, unit, line }) => ({
        name: oi.product.name,
        size: oi.product.size?.value,
        color: oi.product.color?.name,
        quantity: oi.quantity,
        unitPrice: unit.toNumber(),
        lineTotal: line.toNumber(),
      })),
    },
  };
}
