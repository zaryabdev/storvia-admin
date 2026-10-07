"use client";

import { ColumnDef } from "@tanstack/react-table";
import { CellAction } from "./cell-action";
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

    // WhatsApp button: which template applies, and the ready wa.me link
    // (null when the phone number can't be used for WhatsApp).
    whatsappKind: "confirm" | "message";
    whatsappUrl: string | null;
};

export const columns: ColumnDef<OrderColumn>[] = [
    {
        accessorKey: "trackingId",
        header: "Tracking",
        cell: ({ row }) => (
            <div className="font-mono text-xs">{row.original.trackingId}</div>
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
