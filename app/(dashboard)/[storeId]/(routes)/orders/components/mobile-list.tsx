"use client";

import { CellAction } from "./cell-action";
import { OrderColumn } from "./columns";
import { PrintSlipButton } from "./print-slip-button";
import { WhatsAppButton } from "./whatsapp-button";

interface OrderMobileRowProps {
    order: OrderColumn;
}

export function OrderMobileRow({ order }: OrderMobileRowProps) {
    return (
        <div className="min-w-0 rounded-md border p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="break-words font-mono text-xs [overflow-wrap:anywhere]">
                        {order.trackingId}
                    </p>
                    <p className="mt-1 break-words text-lg font-semibold [overflow-wrap:anywhere]">
                        {order.totalPrice}
                    </p>
                </div>
                <div className="shrink-0">
                    <CellAction data={order} />
                </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                <span className="font-medium break-words">{order.status}</span>
                <span className="text-xs text-muted-foreground">
                    {order.paymentMethod}
                </span>
            </div>

            <dl className="mt-4 grid min-w-0 grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div className="min-w-0">
                    <dt className="text-muted-foreground">Customer</dt>
                    <dd className="break-words font-medium [overflow-wrap:anywhere]">
                        {order.customerName || "—"}
                    </dd>
                </div>
                <div className="min-w-0">
                    <dt className="text-muted-foreground">Date</dt>
                    <dd className="break-words font-medium">{order.createdAt}</dd>
                </div>
                <div className="min-w-0">
                    <dt className="text-muted-foreground">Phone</dt>
                    <dd className="break-words font-medium [overflow-wrap:anywhere]">
                        {order.phone || "—"}
                    </dd>
                </div>
                <div className="min-w-0">
                    <dt className="text-muted-foreground">City</dt>
                    <dd className="break-words font-medium [overflow-wrap:anywhere]">
                        {order.city || "—"}
                    </dd>
                </div>
                <div className="col-span-2 min-w-0">
                    <dt className="text-muted-foreground">Items</dt>
                    <dd className="break-words font-medium [overflow-wrap:anywhere]">
                        {order.products || "—"}
                    </dd>
                </div>
            </dl>

            <WhatsAppButton order={order} className="mt-4" />
            <PrintSlipButton order={order} className="mt-2" />
        </div>
    );
}
