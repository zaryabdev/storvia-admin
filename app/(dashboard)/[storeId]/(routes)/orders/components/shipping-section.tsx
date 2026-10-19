"use client";

import axios from "axios";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    COURIERS,
    ORDER_NOT_SHIPPABLE_MESSAGE,
    OTHER_COURIER_KEY,
    isShippableStatus,
    parseShippingPatch,
} from "@/lib/couriers";

import type { OrderColumn } from "./columns";
import { ConfirmDialog } from "./confirm-dialog";

// The API's message for a 400/409 ({ error, message }), else a generic one.
const errorText = (error: any) => {
    const data = error?.response?.data;
    return typeof data?.message === "string" && data.message ? data.message : "Something went wrong.";
};

const SELECT_CLASS =
    "min-h-[44px] w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50";

// Order details → Shipping → Courier. Set or edit while CONFIRMED / DELIVERED;
// Remove in any status. Never touches status, stock or payment. Rules in
// lib/couriers.ts (the same parser validates here and on the server).
export function ShippingSection({ order }: { order: OrderColumn }) {
    const params = useParams();
    const router = useRouter();
    const shippable = isShippableStatus(order.status);
    const hasValue = order.courierTracking !== "";

    const [editing, setEditing] = useState(false);
    const [courier, setCourier] = useState(order.courier ?? "");
    const [courierName, setCourierName] = useState(order.courierName ?? "");
    const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber ?? "");
    const [error, setError] = useState<string | null>(null);
    const [confirmRemove, setConfirmRemove] = useState(false);
    const [loading, setLoading] = useState(false);

    const idPrefix = `shipping-${order.id}`;
    const showForm = shippable && (editing || !hasValue);

    const startEdit = () => {
        setCourier(order.courier ?? "");
        setCourierName(order.courierName ?? "");
        setTrackingNumber(order.trackingNumber ?? "");
        setError(null);
        setEditing(true);
    };

    const save = async (event: React.FormEvent) => {
        event.preventDefault();
        if (loading) return;

        const body = { courier, courierName, trackingNumber };
        const parsed = parseShippingPatch(body);
        if ("error" in parsed) {
            setError(parsed.message);
            return;
        }

        try {
            setLoading(true);
            setError(null);
            await axios.patch(`/api/${params.storeId}/orders/${order.id}/shipping`, body);
            toast.success("Courier details saved.");
            setEditing(false);
            router.refresh();
        } catch (err) {
            setError(errorText(err));
        } finally {
            setLoading(false);
        }
    };

    const remove = async () => {
        try {
            setLoading(true);
            await axios.patch(`/api/${params.storeId}/orders/${order.id}/shipping`, { courier: null });
            toast.success("Courier details removed.");
            setConfirmRemove(false);
            setEditing(false);
            setCourier("");
            setCourierName("");
            setTrackingNumber("");
            setError(null);
            router.refresh();
        } catch (err) {
            toast.error(errorText(err));
        } finally {
            setLoading(false);
        }
    };

    // A pending order without courier details: nothing to do yet. A canceled
    // order without them: nothing to show.
    if (!shippable && !hasValue) {
        return order.status === "DRAFT" ? (
            <p className="text-sm text-gray-500">{ORDER_NOT_SHIPPABLE_MESSAGE}</p>
        ) : null;
    }

    return (
        <div className="min-w-0">
            <div className="text-xs font-medium text-gray-700">Courier</div>

            {showForm ? (
                <form className="mt-2 min-w-0 space-y-3" onSubmit={save} noValidate>
                    <div className="min-w-0 space-y-1">
                        <Label htmlFor={`${idPrefix}-courier`}>Courier</Label>
                        <select
                            id={`${idPrefix}-courier`}
                            value={courier}
                            disabled={loading}
                            onChange={(event) => {
                                setCourier(event.target.value);
                                setError(null);
                            }}
                            className={SELECT_CLASS}
                        >
                            <option value="">Choose courier</option>
                            {COURIERS.map((option) => (
                                <option key={option.key} value={option.key}>
                                    {option.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {courier === OTHER_COURIER_KEY && (
                        <div className="min-w-0 space-y-1">
                            <Label htmlFor={`${idPrefix}-name`}>Courier name</Label>
                            <Input
                                id={`${idPrefix}-name`}
                                value={courierName}
                                disabled={loading}
                                autoComplete="off"
                                dir="auto"
                                onChange={(event) => {
                                    setCourierName(event.target.value);
                                    setError(null);
                                }}
                                className="min-h-[44px]"
                            />
                        </div>
                    )}

                    <div className="min-w-0 space-y-1">
                        <Label htmlFor={`${idPrefix}-tracking`}>Tracking number</Label>
                        <Input
                            id={`${idPrefix}-tracking`}
                            value={trackingNumber}
                            disabled={loading}
                            autoComplete="off"
                            spellCheck={false}
                            onChange={(event) => {
                                setTrackingNumber(event.target.value);
                                setError(null);
                            }}
                            className="min-h-[44px]"
                        />
                    </div>

                    {error && (
                        <p role="alert" className="break-words text-sm text-red-600 [overflow-wrap:anywhere]">
                            {error}
                        </p>
                    )}

                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
                        <Button type="submit" size="sm" disabled={loading} className="min-h-[44px] w-full sm:w-auto">
                            Save
                        </Button>
                        {editing && (
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={loading}
                                onClick={() => {
                                    setEditing(false);
                                    setError(null);
                                }}
                                className="min-h-[44px] w-full sm:w-auto"
                            >
                                Cancel
                            </Button>
                        )}
                    </div>
                </form>
            ) : (
                <>
                    <div
                        className={`mt-1 break-words text-sm [overflow-wrap:anywhere] ${shippable ? "font-medium text-gray-900" : "text-gray-500"}`}
                    >
                        {order.courierTracking}
                    </div>
                    <div className="mt-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
                        {shippable && (
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={startEdit}
                                className="min-h-[44px] w-full sm:w-auto"
                            >
                                Edit
                            </Button>
                        )}
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setConfirmRemove(true)}
                            className="min-h-[44px] w-full sm:w-auto"
                        >
                            Remove
                        </Button>
                    </div>
                </>
            )}

            <ConfirmDialog
                open={confirmRemove}
                title="Remove courier details?"
                description={`The courier and tracking number (${order.courierTracking}) are removed from this order. The order status doesn't change.`}
                confirmLabel="Remove"
                destructive
                loading={loading}
                onClose={() => {
                    if (!loading) setConfirmRemove(false);
                }}
                onConfirm={remove}
            />
        </div>
    );
}
