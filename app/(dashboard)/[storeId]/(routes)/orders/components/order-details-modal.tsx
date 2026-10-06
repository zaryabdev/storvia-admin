"use client";

import { Modal } from "@/components/ui/modal";
import type { OrderColumn } from "./columns";

export default function OrderDetailsModal({
    open,
    onClose,
    order,
}: {
    open: boolean;
    onClose: () => void;
    order: OrderColumn;
}) {
    return (
        <Modal
            isOpen={open}
            onClose={onClose}
            title="Order details"
            description=""
        >
            <div className="min-w-0 space-y-5">
                {/* Top meta */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="min-w-0 rounded-xl border p-3">
                        <div className="text-xs text-gray-500">Tracking</div>
                        <div className="mt-1 break-words font-mono text-sm [overflow-wrap:anywhere]">
                            {order.trackingId}
                        </div>
                    </div>

                    <div className="min-w-0 rounded-xl border p-3">
                        <div className="text-xs text-gray-500">Status</div>
                        <div className="mt-1 break-words text-sm font-medium [overflow-wrap:anywhere]">
                            {order.status}
                        </div>
                    </div>

                    <div className="min-w-0 rounded-xl border p-3">
                        <div className="text-xs text-gray-500">
                            Payment method
                        </div>
                        <div className="mt-1 break-words text-sm font-medium [overflow-wrap:anywhere]">
                            {order.paymentMethod}
                        </div>
                    </div>

                    <div className="min-w-0 rounded-xl border p-3">
                        <div className="text-xs text-gray-500">Total</div>
                        <div className="mt-1 break-words text-sm font-semibold [overflow-wrap:anywhere]">
                            {order.totalPrice}
                        </div>
                    </div>
                </div>

                {/* Customer */}
                <div className="min-w-0 rounded-2xl border p-4">
                    <div className="text-sm font-semibold text-gray-900">
                        Customer
                    </div>
                    <div className="mt-2 min-w-0 space-y-1 text-sm text-gray-700">
                        <div className="break-words [overflow-wrap:anywhere]">
                            <span className="text-gray-500">Name:</span>{" "}
                            {order.customerName || "—"}
                        </div>
                        <div className="break-words [overflow-wrap:anywhere]">
                            <span className="text-gray-500">Email:</span>{" "}
                            {order.email || "—"}
                        </div>
                        <div className="break-words [overflow-wrap:anywhere]">
                            <span className="text-gray-500">Phone:</span>{" "}
                            {order.phone || "—"}
                        </div>
                    </div>
                </div>

                {/* Shipping */}
                <div className="min-w-0 rounded-2xl border p-4">
                    <div className="text-sm font-semibold text-gray-900">
                        Shipping
                    </div>
                    <div className="mt-2 min-w-0 text-sm text-gray-700">
                        <div className="break-words [overflow-wrap:anywhere]">
                            {order.shippingAddress || "—"}
                        </div>

                        {order.customerNotes ? (
                            <div className="mt-3 min-w-0 rounded-xl bg-gray-50 p-3 text-sm">
                                <div className="text-xs font-medium text-gray-700">
                                    Delivery notes
                                </div>
                                <div className="mt-1 break-words text-gray-700 [overflow-wrap:anywhere]">
                                    {order.customerNotes}
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>

                {/* Items */}
                <div className="min-w-0 rounded-2xl border p-4">
                    <div className="text-sm font-semibold text-gray-900">
                        Items
                    </div>
                    <div className="mt-2 break-words text-sm text-gray-700 [overflow-wrap:anywhere]">
                        {order.products || "—"}
                    </div>
                </div>
            </div>
        </Modal>
    );
}
