"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { OrderColumn } from "./columns";

// A small neutral "Manual" badge for orders the merchant created in Admin;
// nothing for Storefront (WEBSITE) orders.
export function SourceBadge({ source, className }: { source: OrderColumn["source"]; className?: string }) {
    if (source !== "MANUAL") return null;

    return (
        <Badge
            className={cn(
                "whitespace-nowrap rounded-md border-gray-200 bg-gray-100 px-2 py-0.5 font-medium text-gray-700 hover:bg-gray-100",
                className,
            )}
        >
            Manual<span className="sr-only"> order, created in Admin</span>
        </Badge>
    );
}
