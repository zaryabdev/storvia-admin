"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    CUSTOMER_COMPARATORS,
    DEFAULT_CUSTOMER_SORT,
    matchesCustomerQuery,
    type CustomerRow,
    type CustomerSort,
} from "@/lib/customer-search";

import { BlockedBadge } from "../../orders/components/blocked-phone";
import { BlockedNumbersModal, type BlockedNumberRow } from "./blocked-numbers-modal";
import { CustomerMobileRow } from "./mobile-list";
import { CustomerRowAction } from "./row-action";

// Customers per page. QA: set to 2 locally to check paging, then revert (never commit it).
export const CUSTOMERS_PAGE_SIZE = 50;

const SORT_OPTIONS: Array<{ value: CustomerSort; label: string }> = [
    { value: "lastOrder", label: "Last order" },
    { value: "totalSpent", label: "Total spent" },
    { value: "orderCount", label: "Orders" },
];

const isCustomerSort = (value: string): value is CustomerSort =>
    SORT_OPTIONS.some((option) => option.value === value);

interface CustomerClientProps {
    data: CustomerRow[];
    /** The Store's blocklist, newest first. */
    blockedNumbers: BlockedNumberRow[];
}

// Search, sort and page are client state only: nothing goes in the URL.
export const CustomerClient: React.FC<CustomerClientProps> = ({ data, blockedNumbers }) => {
    const [query, setQuery] = useState("");
    const [blockedOpen, setBlockedOpen] = useState(false);
    const [sort, setSort] = useState<CustomerSort>(DEFAULT_CUSTOMER_SORT);
    const [page, setPage] = useState(0);

    const results = useMemo(
        () => data.filter((row) => matchesCustomerQuery(row, query)).sort(CUSTOMER_COMPARATORS[sort]),
        [data, query, sort],
    );

    const pageCount = Math.max(1, Math.ceil(results.length / CUSTOMERS_PAGE_SIZE));
    const currentPage = Math.min(page, pageCount - 1);
    const start = currentPage * CUSTOMERS_PAGE_SIZE;
    const rows = results.slice(start, start + CUSTOMERS_PAGE_SIZE);
    const hasQuery = query.trim() !== "";

    const clearSearch = () => {
        setQuery("");
        setPage(0);
    };

    return (
        <>
            <div className="heading-action-row">
                <Heading
                    title={`Customers (${data.length})`}
                    description="Built from your orders. Customers are matched by phone number."
                />
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => setBlockedOpen(true)}
                    className="min-h-[44px] w-full sm:min-h-0 sm:w-auto"
                >
                    Blocked numbers ({blockedNumbers.length})
                </Button>
            </div>
            <BlockedNumbersModal
                open={blockedOpen}
                onClose={() => setBlockedOpen(false)}
                items={blockedNumbers}
            />
            <Separator />

            {data.length === 0 ? (
                <div className="flex min-h-[160px] flex-col items-center justify-center rounded-md border p-6 text-center">
                    <p className="font-medium">No customers yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Customers appear here after your first order.
                    </p>
                </div>
            ) : (
                <>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <div className="min-w-0 flex-1 sm:max-w-sm">
                            <Input
                                type="search"
                                aria-label="Search customers"
                                placeholder="Search name or phone"
                                value={query}
                                onChange={(event) => {
                                    setQuery(event.target.value);
                                    setPage(0);
                                }}
                                className="min-h-[44px]"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <label htmlFor="customer-sort" className="shrink-0 text-sm text-muted-foreground">
                                Sort by
                            </label>
                            <select
                                id="customer-sort"
                                value={sort}
                                onChange={(event) => {
                                    if (isCustomerSort(event.target.value)) setSort(event.target.value);
                                    setPage(0);
                                }}
                                className="min-h-[44px] min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 sm:flex-none"
                            >
                                {SORT_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {results.length === 0 ? (
                        <div className="flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-md border p-6 text-center">
                            <p className="break-words font-medium [overflow-wrap:anywhere]">
                                No customers match &quot;{query.trim()}&quot;
                            </p>
                            {hasQuery ? (
                                <Button variant="outline" className="min-h-[44px]" onClick={clearSearch}>
                                    Clear search
                                </Button>
                            ) : null}
                        </div>
                    ) : (
                        <>
                            <div className="space-y-3 md:hidden">
                                {rows.map((customer) => (
                                    <CustomerMobileRow key={customer.id} customer={customer} />
                                ))}
                            </div>

                            <div className="hidden rounded-md border md:block">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Phone</TableHead>
                                            <TableHead>Orders</TableHead>
                                            <TableHead>Total spent</TableHead>
                                            <TableHead>Last order</TableHead>
                                            <TableHead>
                                                <span className="sr-only">Actions</span>
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {rows.map((customer) => (
                                            <TableRow key={customer.id}>
                                                <TableCell className="max-w-[260px]">
                                                    <div
                                                        className={
                                                            customer.hasName
                                                                ? "break-words text-sm font-medium [overflow-wrap:anywhere]"
                                                                : "text-sm text-muted-foreground"
                                                        }
                                                    >
                                                        {customer.name}
                                                    </div>
                                                    {customer.email ? (
                                                        <div className="truncate text-xs text-muted-foreground" title={customer.email}>
                                                            {customer.email}
                                                        </div>
                                                    ) : null}
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap">
                                                    <div>{customer.phone}</div>
                                                    <BlockedBadge
                                                        blocked={customer.blockedPhoneId !== null}
                                                        className="mt-1"
                                                    />
                                                </TableCell>
                                                <TableCell>{customer.orderCount}</TableCell>
                                                <TableCell className="whitespace-nowrap">{customer.totalSpent}</TableCell>
                                                <TableCell className="whitespace-nowrap">{customer.lastOrderDate}</TableCell>
                                                <TableCell className="text-right">
                                                    <CustomerRowAction customer={customer} />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            <p className="text-xs text-muted-foreground">
                                Total spent counts confirmed and delivered orders, incl. delivery.
                            </p>

                            {results.length > CUSTOMERS_PAGE_SIZE ? (
                                <div className="flex flex-wrap items-center justify-between gap-2 py-2">
                                    <p className="text-sm text-muted-foreground">
                                        Showing {start + 1}–{start + rows.length} of {results.length}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            className="min-h-[44px]"
                                            onClick={() => setPage(currentPage - 1)}
                                            disabled={currentPage === 0}
                                        >
                                            Previous
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="min-h-[44px]"
                                            onClick={() => setPage(currentPage + 1)}
                                            disabled={currentPage >= pageCount - 1}
                                        >
                                            Next
                                        </Button>
                                    </div>
                                </div>
                            ) : null}
                        </>
                    )}
                </>
            )}
        </>
    );
};
