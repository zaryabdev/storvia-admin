"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { CustomerRow } from "@/lib/customer-search";

import CustomerDetailsModal from "./customer-details-modal";

// The per-row action (table row and phone card): opens the read-only details.
// Open state is local to the row, so nothing goes in the URL, and closing
// returns focus to this button.
export function CustomerRowAction({ customer }: { customer: CustomerRow }) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-[44px] min-w-[44px]"
                aria-label={`View customer ${customer.hasName ? customer.name : customer.phone}`}
                onClick={() => setOpen(true)}
            >
                View
            </Button>
            <CustomerDetailsModal open={open} onClose={() => setOpen(false)} customer={customer} />
        </>
    );
}
