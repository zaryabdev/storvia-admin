"use client";

import { MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { CustomerRow } from "@/lib/customer-search";
import { orderStatusLabel } from "@/lib/order-status";

import { BlockPhoneAction, BlockedBadge } from "../../orders/components/blocked-phone";
import { PaymentSummary } from "../../orders/components/payment-badge";

// The customer, a WhatsApp chat link (no prefilled text), Block number /
// Unblock and every order, newest first. Nothing here edits an order or puts a
// phone in a URL.
export default function CustomerDetailsModal({
    open,
    onClose,
    customer,
}: {
    open: boolean;
    onClose: () => void;
    customer: CustomerRow;
}) {
    return (
        <Modal
            isOpen={open}
            onClose={onClose}
            title="Customer details"
            description="Built from this customer's orders."
        >
            <div className="min-w-0 space-y-5">
                <div className="min-w-0">
                    <p
                        className={
                            customer.hasName
                                ? "break-words text-lg font-semibold [overflow-wrap:anywhere]"
                                : "text-lg font-semibold text-muted-foreground"
                        }
                    >
                        {customer.name}
                    </p>
                    <p className="break-words text-sm [overflow-wrap:anywhere]">{customer.phone}</p>
                    <BlockedBadge blocked={customer.blockedPhoneId !== null} className="mt-1" />
                    {customer.email ? (
                        <p className="break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
                            {customer.email}
                        </p>
                    ) : null}
                </div>

                {customer.whatsappUrl ? (
                    <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="min-h-[44px] w-full justify-start gap-2 sm:w-auto"
                    >
                        <a
                            href={customer.whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Chat with customer on WhatsApp"
                        >
                            <MessageCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                            <span className="truncate">Chat on WhatsApp</span>
                        </a>
                    </Button>
                ) : (
                    <div className="min-w-0 space-y-1">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled
                            aria-label="Chat with customer on WhatsApp"
                            className="min-h-[44px] w-full justify-start gap-2 sm:w-auto"
                        >
                            <MessageCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                            <span className="truncate">Chat on WhatsApp</span>
                        </Button>
                        <p className="text-xs text-muted-foreground">
                            Phone number can&apos;t be used for WhatsApp.
                        </p>
                    </div>
                )}

                <div className="empty:hidden">
                    <BlockPhoneAction phone={customer.phone} blockedPhoneId={customer.blockedPhoneId} />
                </div>

                <div className="min-w-0 rounded-xl border p-3 text-sm">
                    <p className="break-words font-medium [overflow-wrap:anywhere]">
                        Orders {customer.orderCount} · Total spent {customer.totalSpent} · Last order{" "}
                        {customer.lastOrderDate}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                        Total spent counts confirmed and delivered orders, incl. delivery.
                    </p>
                </div>

                <div className="min-w-0">
                    <h3 className="text-sm font-semibold">Orders</h3>
                    <ul className="mt-2 space-y-2">
                        {customer.orders.map((order) => (
                            <li key={order.id} className="min-w-0 rounded-xl border p-3 text-sm">
                                <div className="flex items-start justify-between gap-3">
                                    <p className="min-w-0 break-words font-mono text-xs [overflow-wrap:anywhere]">
                                        {order.trackingId}
                                    </p>
                                    <p className="shrink-0 font-semibold">{order.total}</p>
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <span className="text-muted-foreground">{order.date}</span>
                                    <span className="font-medium">{orderStatusLabel(order.status)}</span>
                                    <PaymentSummary order={order} className="text-xs text-muted-foreground" />
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </Modal>
    );
}
