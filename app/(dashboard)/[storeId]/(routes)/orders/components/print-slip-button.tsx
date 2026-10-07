"use client";

import { Printer } from "lucide-react";
import { useParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { OrderColumn } from "./columns";

// The packing-slip print page for an order (outside the dashboard layout).
export const slipHref = (storeId: string, orderId: string) =>
    `/${storeId}/orders/${orderId}/slip`;

interface PrintSlipButtonProps {
    order: Pick<OrderColumn, "id" | "trackingId">;
    className?: string;
}

// Opens the order's packing slip in a new tab; printing happens there.
export function PrintSlipButton({ order, className }: PrintSlipButtonProps) {
    const params = useParams();

    return (
        <Button
            asChild
            variant="outline"
            size="sm"
            className={cn("min-h-[40px] w-full justify-start gap-2 sm:w-auto", className)}
        >
            <a
                href={slipHref(String(params.storeId), order.id)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Print packing slip for order ${order.trackingId} (opens in a new tab)`}
            >
                <Printer className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">Print slip</span>
            </a>
        </Button>
    );
}
