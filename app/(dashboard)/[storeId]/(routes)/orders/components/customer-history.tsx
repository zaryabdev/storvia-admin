"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { OrderColumn } from "./columns";

// "First order" (neutral badge), "3 orders" (muted text) or "3 orders · 2 canceled"
// (amber badge, never red). Plain text read after the phone; the words carry the
// meaning, the colour only backs them up. Nothing when the phone has no customer key.
export function CustomerHistory({
    history,
    className,
}: {
    history: OrderColumn["customerHistory"];
    className?: string;
}) {
    if (!history) return null;

    if (history.tone === "normal") {
        return (
            <p className={cn("break-words text-xs text-muted-foreground [overflow-wrap:anywhere]", className)}>
                {history.text}
            </p>
        );
    }

    return (
        <Badge
            className={cn(
                "max-w-full whitespace-normal rounded-md px-2 py-0.5 text-left font-medium [overflow-wrap:anywhere]",
                history.tone === "warning"
                    ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-50"
                    : "border-gray-200 bg-gray-100 text-gray-700 hover:bg-gray-100",
                className,
            )}
        >
            {history.text}
        </Badge>
    );
}
