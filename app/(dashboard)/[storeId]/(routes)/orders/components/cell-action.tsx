"use client";

import axios from "axios";
import { MoreHorizontal } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "react-hot-toast";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { OrderColumn } from "./columns";
import OrderDetailsModal from "./order-details-modal";
import { slipHref } from "./print-slip-button";

interface CellActionProps {
    data: OrderColumn;
}

// Mirrors the transition matrix enforced server-side in
// app/api/[storeId]/orders/[orderId]/route.ts — keeps the dropdown from
// offering an action the API would now reject as an invalid transition.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
    DRAFT: ["CONFIRMED", "CANCELED"],
    CONFIRMED: ["DELIVERED", "CANCELED"],
    CANCELED: ["CONFIRMED"],
    DELIVERED: [],
};

export const CellAction: React.FC<CellActionProps> = ({ data }) => {
    const router = useRouter();
    const params = useParams();

    const [openDetails, setOpenDetails] = useState(false);

    const allowedTargets = ALLOWED_TRANSITIONS[data.status] ?? [];

    const onStatusChange = useCallback(
        async (status: string) => {
            try {
                await axios.patch(`/api/${params.storeId}/orders/${data.id}`, {
                    status,
                });
                toast.success("Order updated.");
                router.refresh();
            } catch {
                toast.error("Something went wrong.");
            }
        },
        [data.id, params.storeId, router],
    );

    return (
        <>
            <OrderDetailsModal
                open={openDetails}
                onClose={() => setOpenDetails(false)}
                order={data}
            />

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        className="h-10 w-10 p-0 sm:h-8 sm:w-8"
                        aria-label="Open order actions"
                    >
                        <MoreHorizontal className="w-4 h-4" />
                    </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setOpenDetails(true)}>
                        View details
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <a
                            href={slipHref(String(params.storeId), data.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Print packing slip for order ${data.trackingId} (opens in a new tab)`}
                        >
                            Print slip
                        </a>
                    </DropdownMenuItem>

                    {allowedTargets.includes("CONFIRMED") && (
                        <DropdownMenuItem
                            onClick={() => onStatusChange("CONFIRMED")}
                        >
                            Mark Confirmed
                        </DropdownMenuItem>
                    )}
                    {allowedTargets.includes("DELIVERED") && (
                        <DropdownMenuItem
                            onClick={() => onStatusChange("DELIVERED")}
                        >
                            Mark Delivered
                        </DropdownMenuItem>
                    )}
                    {allowedTargets.includes("CANCELED") && (
                        <DropdownMenuItem
                            onClick={() => onStatusChange("CANCELED")}
                        >
                            Cancel Order
                        </DropdownMenuItem>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </>
    );
};
