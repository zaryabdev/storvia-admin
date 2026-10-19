"use client";

import { ColumnDef } from "@tanstack/react-table";
import { BlockedBadge } from "./blocked-phone";
import { CellAction } from "./cell-action";
import { CustomerHistory } from "./customer-history";
import { PaymentSummary } from "./payment-badge";
import { SourceBadge } from "./source-badge";
import { WhatsAppButton } from "./whatsapp-button";

export type OrderColumn = {
    id: string;

    trackingId: string;

    customerName: string;
    email: string;
    phone: string;

    addressLine1: string;
    addressLine2: string;
    city: string;
    postalCode: string;
    country: string;
    customerNotes: string;

    shippingAddress: string;

    totalPrice: string;
    /** Display strings: items subtotal; delivery "Rs 200" / "Free" / "—" (legacy). */
    subtotalPrice: string;
    deliveryPrice: string;
    products: string;

    status: string;
    paymentMethod: string;
    createdAt: string;
    /** WEBSITE (Storefront checkout) or MANUAL (created in Admin; "Manual" badge). */
    source: string;

    // Payment (bank transfer orders): whether it was marked paid, how, and when
    // ("October 12th, 2026"; null while unpaid). bankTransferAvailable = the
    // Store offers bank transfer (for "Change payment method").
    isPaid: boolean;
    paymentReceivedVia: string | null;
    paidAt: string | null;
    bankTransferAvailable: boolean;

    // Courier and tracking number (lib/couriers.ts; all three set or all
    // null) and the display string "TCS · 1234567890" ("" when not set).
    courier: string | null;
    courierName: string | null;
    trackingNumber: string | null;
    courierTracking: string;

    // WhatsApp button: which template applies, and the ready wa.me link
    // (null when the phone number can't be used for WhatsApp).
    whatsappKind: "confirm" | "message";
    whatsappUrl: string | null;

    // "3 orders · 2 canceled" under the phone (server-computed; null = the
    // phone has no customer key).
    customerHistory: { text: string; tone: "first" | "normal" | "warning" } | null;

    // The phone's row on the Store's blocklist ("Blocked" badge, Unblock), or
    // null when the number isn't blocked.
    blockedPhoneId: string | null;
};

export const columns: ColumnDef<OrderColumn>[] = [
    {
        accessorKey: "trackingId",
        header: "Tracking",
        cell: ({ row }) => (
            <div>
                <div className="font-mono text-xs">{row.original.trackingId}</div>
                <SourceBadge source={row.original.source} className="mt-1" />
                {row.original.courierTracking ? (
                    <div className="mt-1 max-w-[160px] break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
                        {row.original.courierTracking}
                    </div>
                ) : null}
            </div>
        ),
    },
    {
        accessorKey: "customerName",
        header: "Customer",
        cell: ({ row }) => (
            <div className="min-w-[160px]">
                <div className="text-sm font-medium text-gray-900">
                    {row.original.customerName || "—"}
                </div>
                <div className="text-xs text-gray-500 truncate">
                    {row.original.email || "—"}
                </div>
            </div>
        ),
    },
    {
        accessorKey: "phone",
        header: "Phone",
        cell: ({ row }) => (
            <div className="min-w-[110px]">
                <div>{row.original.phone}</div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 empty:hidden">
                    <CustomerHistory history={row.original.customerHistory} />
                    <BlockedBadge blocked={row.original.blockedPhoneId !== null} />
                </div>
            </div>
        ),
    },
    {
        accessorKey: "city",
        header: "City",
        cell: ({ row }) => row.original.city || "—",
    },
    {
        accessorKey: "totalPrice",
        header: "Total",
    },
    {
        accessorKey: "paymentMethod",
        header: "Payment",
        cell: ({ row }) => <PaymentSummary order={row.original} className="min-w-[120px]" />,
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
            const v = row.original.status;
            return (
                <div className="flex items-center gap-2">
                    <span className="text-sm">{v}</span>
                </div>
            );
        },
    },
    {
        id: "whatsapp",
        header: "WhatsApp",
        cell: ({ row }) => (
            <div className="min-w-[190px]">
                <WhatsAppButton order={row.original} />
            </div>
        ),
    },
    {
        id: "actions",
        cell: ({ row }) => <CellAction data={row.original} />,
    },
];
