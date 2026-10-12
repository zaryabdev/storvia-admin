"use client";

import axios from "axios";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-hot-toast";

import { Button } from "@/components/ui/button";
import {
    PAYMENT_METHOD_LABELS,
    PAYMENT_RECEIVED_VIA,
    canChangePaymentMethod,
    type CheckoutPaymentMethod,
    type PaymentReceivedViaValue,
} from "@/lib/order-payment";

import type { OrderColumn } from "./columns";
import { ConfirmDialog } from "./confirm-dialog";
import { PaymentBadge } from "./payment-badge";

type Dialog = "paid" | "unpaid" | "method" | null;

// The API's message for a 400/409 ({ error, message }), else a generic one.
const errorText = (error: any) => {
    const data = error?.response?.data;
    return typeof data?.message === "string" && data.message ? data.message : "Something went wrong.";
};

// Order details → Payment. Payment is separate from the order status: marking
// paid/unpaid or changing the method never touches status or stock.
export function PaymentSection({ order }: { order: OrderColumn }) {
    const params = useParams();
    const router = useRouter();
    const [dialog, setDialog] = useState<Dialog>(null);
    const [receivedVia, setReceivedVia] = useState<PaymentReceivedViaValue | null>(null);
    const [loading, setLoading] = useState(false);

    const bankTransfer = order.paymentMethod === "BANK_TRANSFER";
    const otherMethod: CheckoutPaymentMethod = bankTransfer ? "COD" : "BANK_TRANSFER";
    const canChange = canChangePaymentMethod(order, otherMethod, order.bankTransferAvailable);
    const methodLabel = PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod;

    const close = () => {
        if (loading) return;
        setDialog(null);
        setReceivedVia(null);
    };

    const patch = async (body: Record<string, unknown>, success: string) => {
        try {
            setLoading(true);
            await axios.patch(`/api/${params.storeId}/orders/${order.id}/payment`, body);
            toast.success(success);
            setDialog(null);
            setReceivedVia(null);
            router.refresh();
        } catch (error) {
            toast.error(errorText(error));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-w-0 rounded-2xl border p-4">
            <div className="text-sm font-semibold text-gray-900">Payment</div>
            <div className="mt-2 min-w-0 space-y-2 text-sm text-gray-700">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="font-medium">{methodLabel}</span>
                    <PaymentBadge order={order} />
                </div>
                {order.isPaid && order.paidAt ? (
                    <div className="text-gray-500">Marked paid on {order.paidAt}</div>
                ) : null}
            </div>

            {(bankTransfer || canChange) && (
                <div className="mt-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
                    {bankTransfer && !order.isPaid && (
                        <Button
                            type="button"
                            size="sm"
                            className="min-h-[44px] w-full sm:w-auto"
                            onClick={() => setDialog("paid")}
                        >
                            Mark paid
                        </Button>
                    )}
                    {order.isPaid && (
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="min-h-[44px] w-full sm:w-auto"
                            onClick={() => setDialog("unpaid")}
                        >
                            Mark unpaid
                        </Button>
                    )}
                    {canChange && (
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="min-h-[44px] w-full sm:w-auto"
                            onClick={() => setDialog("method")}
                        >
                            Change payment method
                        </Button>
                    )}
                </div>
            )}

            <ConfirmDialog
                open={dialog === "paid"}
                title="How did you receive the money?"
                description={`Order ${order.trackingId} · ${order.totalPrice}`}
                confirmLabel="Mark paid"
                loading={loading}
                confirmDisabled={!receivedVia}
                onClose={close}
                onConfirm={() =>
                    receivedVia && patch({ action: "MARK_PAID", receivedVia }, "Marked as paid.")
                }
            >
                <fieldset className="min-w-0 space-y-2" disabled={loading}>
                    <legend className="sr-only">How did you receive the money?</legend>
                    {PAYMENT_RECEIVED_VIA.map((option) => (
                        <label
                            key={option.value}
                            className={`flex min-h-[44px] min-w-0 cursor-pointer items-center gap-3 rounded-md border px-3 text-sm ${receivedVia === option.value ? "border-primary ring-1 ring-primary" : ""}`}
                        >
                            <input
                                type="radio"
                                name={`received-via-${order.id}`}
                                value={option.value}
                                checked={receivedVia === option.value}
                                onChange={() => setReceivedVia(option.value)}
                                className="h-4 w-4 shrink-0"
                            />
                            <span className="min-w-0 break-words">{option.label}</span>
                        </label>
                    ))}
                </fieldset>
            </ConfirmDialog>

            <ConfirmDialog
                open={dialog === "unpaid"}
                title="Mark this order unpaid?"
                description="Use this if you marked it paid by mistake. The order status doesn't change."
                confirmLabel="Mark unpaid"
                destructive
                loading={loading}
                onClose={close}
                onConfirm={() => patch({ action: "MARK_UNPAID" }, "Marked as unpaid.")}
            />

            <ConfirmDialog
                open={dialog === "method"}
                title="Change payment method?"
                description={`Change this order from ${methodLabel} to ${PAYMENT_METHOD_LABELS[otherMethod]}.`}
                confirmLabel={`Change to ${PAYMENT_METHOD_LABELS[otherMethod]}`}
                loading={loading}
                onClose={close}
                onConfirm={() =>
                    patch({ action: "CHANGE_METHOD", paymentMethod: otherMethod }, "Payment method changed.")
                }
            />
        </div>
    );
}
