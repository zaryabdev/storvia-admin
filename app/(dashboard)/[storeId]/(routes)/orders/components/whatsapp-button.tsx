"use client";

import { MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { OrderColumn } from "./columns";

interface WhatsAppButtonProps {
    order: Pick<OrderColumn, "whatsappKind" | "whatsappUrl">;
    className?: string;
}

// Opens WhatsApp with the order's message (wa.me link built on the server).
// Nothing is sent and the order status never changes. Draft orders get
// "Confirm on WhatsApp"; every other status gets "Message on WhatsApp". With
// a phone number WhatsApp can't use, the button is disabled and says why.
export function WhatsAppButton({ order, className }: WhatsAppButtonProps) {
    const isConfirm = order.whatsappKind === "confirm";
    const label = isConfirm ? "Confirm on WhatsApp" : "Message on WhatsApp";
    const accessibleLabel = isConfirm
        ? "Confirm order on WhatsApp"
        : "Message customer on WhatsApp";

    if (!order.whatsappUrl) {
        return (
            <div className={cn("min-w-0 space-y-1", className)}>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled
                    aria-label={accessibleLabel}
                    className="min-h-[40px] w-full justify-start gap-2 sm:w-auto"
                >
                    <MessageCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{label}</span>
                </Button>
                <p className="text-xs text-muted-foreground">
                    Phone number can&apos;t be used for WhatsApp.
                </p>
            </div>
        );
    }

    return (
        <Button
            asChild
            variant="outline"
            size="sm"
            className={cn("min-h-[40px] w-full justify-start gap-2 sm:w-auto", className)}
        >
            <a
                href={order.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={accessibleLabel}
            >
                <MessageCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{label}</span>
            </a>
        </Button>
    );
}
