import { format } from "date-fns";

import prismadb from "@/lib/prismadb";
import { formatter } from "@/lib/utils";
import { formatDeliveryDays } from "@/lib/delivery";
import { formatDeliveryFee } from "@/lib/order-template";
import { buildOrderWhatsAppUrl, whatsAppKindFor } from "@/lib/whatsapp-message";

import { OrderClient } from "./components/client";
import { OrderColumn } from "./components/columns";

function buildShippingAddress(o: any) {
    const parts = [
        o.addressLine1,
        o.addressLine2,
        [o.city, o.postalCode].filter(Boolean).join(" "),
        o.country,
    ].filter(Boolean);

    const formatted = parts.join(", ");
    return formatted || o.address || "";
}

const OrdersPage = async ({ params }: { params: { storeId: string } }) => {
    // Store name, sender details + templates feed the WhatsApp buttons (rendered here, so the
    // client only gets a ready link, or null when the phone can't be used).
    const store = await prismadb.store.findUnique({
        where: { id: params.storeId },
        select: {
            name: true,
            whatsappConfirmTemplate: true,
            whatsappMessageTemplate: true,
            senderName: true,
            senderPhone: true,
            senderAddress: true,
            senderCity: true,
            deliveryDaysMin: true,
            deliveryDaysMax: true,
        },
    });

    const orders = await prismadb.order.findMany({
        where: { storeId: params.storeId },
        include: {
            orderItems: {
                include: {
                    product: { include: { size: true, color: true } },
                },
            },
        },
        orderBy: { createdAt: "desc" },
    });

    const deliveryDays = store ? formatDeliveryDays(store.deliveryDaysMin, store.deliveryDaysMax) : "";
    const formattedOrders: OrderColumn[] = orders.map((item) => {
        // Snapshot-backed orders use immutable Order.total. Legacy orders have
        // no authoritative historical amount; retain the old display fallback.
        const total =
            item.total != null
                ? Number(item.total)
                : item.orderItems.reduce(
                      (sum, oi) => sum + Number(oi.product.price) * oi.quantity,
                      0,
                  );

        const whatsappUrl = buildOrderWhatsAppUrl(
            {
                storeName: store?.name ?? "",
                trackingId: item.trackingId,
                createdAt: item.createdAt,
                status: item.status,
                paymentMethod: item.paymentMethod,
                customerName: item.customerName ?? "",
                email: item.email ?? "",
                phone: item.phone ?? "",
                addressLine1: item.addressLine1 ?? "",
                addressLine2: item.addressLine2 ?? "",
                city: item.city ?? "",
                postalCode: item.postalCode ?? "",
                country: item.country ?? "PK",
                legacyAddress: item.address ?? "",
                customerNotes: item.customerNotes ?? "",
                subtotal: item.subtotal != null ? Number(item.subtotal) : null,
                total,
                items: item.orderItems.map((oi) => ({
                    name: oi.product.name,
                    size: oi.product.size?.value,
                    color: oi.product.color?.name,
                    quantity: oi.quantity,
                })),
                deliveryFee: item.deliveryFee?.toFixed() ?? null,
                deliveryDays,
                senderName: store?.senderName,
                senderPhone: store?.senderPhone,
                senderAddress: store?.senderAddress,
                senderCity: store?.senderCity,
            },
            {
                confirmTemplate: store?.whatsappConfirmTemplate ?? null,
                messageTemplate: store?.whatsappMessageTemplate ?? null,
            },
        );

        return {
        id: item.id,

        trackingId: item.trackingId,

        customerName: item.customerName ?? "",
        email: item.email ?? "",
        phone: item.phone ?? "",

        addressLine1: item.addressLine1 ?? "",
        addressLine2: item.addressLine2 ?? "",
        city: item.city ?? "",
        postalCode: item.postalCode ?? "",
        country: item.country ?? "PK",
        customerNotes: item.customerNotes ?? "",

        // handy display string (for table & modal)
        shippingAddress: buildShippingAddress(item),

        products: item.orderItems
            .map((oi) => `${oi.product.name} × ${oi.quantity}`)
            .join(", "),
        // Snapshot-backed orders use immutable Order.total. Legacy orders have
        // no authoritative historical amount; retain the old display fallback.
        totalPrice: formatter.format(total),
        // Display strings only (Decimals never reach the client). A legacy
        // order has no subtotal snapshot (items fallback) and no delivery fee.
        subtotalPrice: formatter.format(item.subtotal != null ? Number(item.subtotal) : total),
        deliveryPrice: item.deliveryFee != null ? formatDeliveryFee(item.deliveryFee.toFixed()) : "—",

        status: item.status,
        paymentMethod: item.paymentMethod,
        createdAt: format(item.createdAt, "MMMM do, yyyy"),

        whatsappKind: whatsAppKindFor(item.status),
        whatsappUrl,
        };
    });

    return (
        <div className="flex-col">
            <div className="flex-1 p-4 pt-4 sm:p-6 sm:pt-6 lg:p-8 lg:pt-6 space-y-4">
                <OrderClient data={formattedOrders} />
            </div>
        </div>
    );
};

export default OrdersPage;
