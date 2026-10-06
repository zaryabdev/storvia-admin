import { format } from "date-fns";

import prismadb from "@/lib/prismadb";
import { formatter } from "@/lib/utils";

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
    const orders = await prismadb.order.findMany({
        where: { storeId: params.storeId },
        include: {
            orderItems: {
                include: {
                    product: true,
                },
            },
        },
        orderBy: { createdAt: "desc" },
    });

    const formattedOrders: OrderColumn[] = orders.map((item) => ({
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
        totalPrice: formatter.format(
            item.total != null
                ? Number(item.total)
                : item.orderItems.reduce(
                      (total, oi) => total + Number(oi.product.price) * oi.quantity,
                      0,
                  ),
        ),

        status: item.status,
        paymentMethod: item.paymentMethod,
        createdAt: format(item.createdAt, "MMMM do, yyyy"),
    }));

    return (
        <div className="flex-col">
            <div className="flex-1 p-4 pt-4 sm:p-6 sm:pt-6 lg:p-8 lg:pt-6 space-y-4">
                <OrderClient data={formattedOrders} />
            </div>
        </div>
    );
};

export default OrdersPage;
