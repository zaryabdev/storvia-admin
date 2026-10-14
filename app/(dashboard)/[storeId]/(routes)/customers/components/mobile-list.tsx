"use client";

import type { CustomerRow } from "@/lib/customer-search";

import { CustomerRowAction } from "./row-action";

export function CustomerMobileRow({ customer }: { customer: CustomerRow }) {
    return (
        <div className="min-w-0 rounded-md border p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p
                        className={
                            customer.hasName
                                ? "break-words font-semibold [overflow-wrap:anywhere]"
                                : "font-semibold text-muted-foreground"
                        }
                    >
                        {customer.name}
                    </p>
                    {customer.email ? (
                        <p className="break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
                            {customer.email}
                        </p>
                    ) : null}
                </div>
                <CustomerRowAction customer={customer} />
            </div>

            <dl className="mt-4 grid min-w-0 grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div className="col-span-2 min-w-0">
                    <dt className="text-muted-foreground">Phone</dt>
                    <dd className="break-words font-medium [overflow-wrap:anywhere]">{customer.phone}</dd>
                </div>
                <div className="min-w-0">
                    <dt className="text-muted-foreground">Orders</dt>
                    <dd className="font-medium">{customer.orderCount}</dd>
                </div>
                <div className="min-w-0">
                    <dt className="text-muted-foreground">Total spent</dt>
                    <dd className="break-words font-medium [overflow-wrap:anywhere]">{customer.totalSpent}</dd>
                </div>
                <div className="col-span-2 min-w-0">
                    <dt className="text-muted-foreground">Last order</dt>
                    <dd className="font-medium">{customer.lastOrderDate}</dd>
                </div>
            </dl>
        </div>
    );
}
