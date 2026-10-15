"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { matchesProductName, productLabel } from "@/lib/manual-order";
import { formatter } from "@/lib/utils";

// A non-archived product of this Store, as the page passes it (price as a decimal string).
export type NewOrderProduct = {
    id: string;
    name: string;
    price: string;
    /** Stock when the page loaded; the server re-checks on create. */
    quantity: number;
    size: string | null;
    color: string | null;
};

/** One order line; `quantity` is the input's text. */
export type OrderLine = { productId: string; quantity: string };

const MAX_RESULTS = 8;

export const labelOf = (product: NewOrderProduct) =>
    productLabel({
        name: product.name,
        size: product.size ? { value: product.size } : null,
        color: product.color ? { name: product.color } : null,
    });

const optionsOf = (product: NewOrderProduct) => [product.size, product.color].filter(Boolean).join(" · ");

const stockText = (quantity: number) => (quantity > 0 ? `${quantity} in stock` : "Out of stock");

// The line's quantity as a number, or the inline error: a whole number from 1 to the stock.
export function lineQuantity(text: string, stock: number): { value: number } | { error: string } {
    const value = /^\d+$/.test(text.trim()) ? Number(text.trim()) : NaN;

    if (!Number.isInteger(value) || value < 1) return { error: "Enter a quantity of 1 or more" };
    if (value > stock) return { error: stock > 0 ? `Only ${stock} in stock` : "Out of stock" };

    return { value };
}

interface ProductPickerProps {
    products: NewOrderProduct[];
    lines: OrderLine[];
    disabled: boolean;
    /** "Add at least one item" after a submit attempt, else null. */
    error: string | null;
    showLineErrors: boolean;
    onAdd: (productId: string) => void;
    onQuantityChange: (productId: string, quantity: string) => void;
    onRemove: (productId: string) => void;
}

export function ProductPicker({
    products,
    lines,
    disabled,
    error,
    showLineErrors,
    onAdd,
    onQuantityChange,
    onRemove,
}: ProductPickerProps) {
    const [query, setQuery] = useState("");

    const byId = new Map(products.map((product) => [product.id, product]));
    const inOrder = new Map(lines.map((line) => [line.productId, line]));
    const matches = products.filter((product) => matchesProductName(product.name, query));
    const shown = matches.slice(0, MAX_RESULTS);

    return (
        <div className="min-w-0 space-y-4">
            <div className="min-w-0 space-y-2">
                <Label htmlFor="product-search">Search products</Label>
                <Input
                    id="product-search"
                    type="search"
                    autoComplete="off"
                    placeholder="Product name"
                    value={query}
                    disabled={disabled}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? "product-search-error" : undefined}
                    className="h-11"
                />
                <p className="text-xs text-muted-foreground" aria-live="polite">
                    {products.length === 0
                        ? "This store has no products yet."
                        : matches.length === 0
                          ? `No products match "${query.trim()}"`
                          : matches.length > shown.length
                            ? `Showing ${shown.length} of ${matches.length}. Type to narrow down.`
                            : `${matches.length} ${matches.length === 1 ? "product" : "products"}`}
                </p>
            </div>

            {shown.length > 0 && (
                <ul className="min-w-0 divide-y rounded-md border" aria-label="Products">
                    {shown.map((product) => {
                        const label = labelOf(product);
                        const current = inOrder.get(product.id);
                        const currentQty = current ? Number(current.quantity) || 0 : 0;
                        const atMax = currentQty >= product.quantity;
                        const outOfStock = product.quantity <= 0;

                        return (
                            <li key={product.id} className="flex min-w-0 items-center gap-3 p-3">
                                <div className="min-w-0 flex-1">
                                    <p className="break-words text-sm font-medium [overflow-wrap:anywhere]">
                                        {product.name}
                                    </p>
                                    <p className="break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
                                        {[optionsOf(product), formatter.format(Number(product.price)), stockText(product.quantity)]
                                            .filter(Boolean)
                                            .join(" · ")}
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={disabled || outOfStock || atMax}
                                    onClick={() => onAdd(product.id)}
                                    aria-label={
                                        outOfStock
                                            ? `${label} is out of stock`
                                            : atMax
                                              ? `All ${product.quantity} of ${label} are in this order`
                                              : current
                                                ? `Add one more ${label}`
                                                : `Add ${label}`
                                    }
                                    className="min-h-[44px] shrink-0"
                                >
                                    {outOfStock ? "Out of stock" : atMax ? "All added" : "Add"}
                                </Button>
                            </li>
                        );
                    })}
                </ul>
            )}

            <div className="min-w-0 space-y-2">
                <h3 className="text-sm font-medium">In this order</h3>
                {lines.length === 0 ? (
                    <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                        No items yet. Search for a product and tap Add.
                    </p>
                ) : (
                    <ul className="min-w-0 divide-y rounded-md border">
                        {lines.map((line) => {
                            const product = byId.get(line.productId);
                            if (!product) return null;

                            const label = labelOf(product);
                            const parsed = lineQuantity(line.quantity, product.quantity);
                            const lineError = showLineErrors && "error" in parsed ? parsed.error : null;
                            const qty = "value" in parsed ? parsed.value : null;
                            const inputId = `qty-${product.id}`;

                            return (
                                <li key={line.productId} className="min-w-0 space-y-2 p-3">
                                    <div className="flex min-w-0 items-start gap-3">
                                        <div className="min-w-0 flex-1">
                                            <p className="break-words text-sm font-medium [overflow-wrap:anywhere]">
                                                {product.name}
                                            </p>
                                            <p className="break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
                                                {[
                                                    optionsOf(product),
                                                    `${formatter.format(Number(product.price))} each`,
                                                    stockText(product.quantity),
                                                ]
                                                    .filter(Boolean)
                                                    .join(" · ")}
                                            </p>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            disabled={disabled}
                                            onClick={() => onRemove(product.id)}
                                            aria-label={`Remove ${label}`}
                                            className="h-11 w-11 shrink-0"
                                        >
                                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                                        </Button>
                                    </div>
                                    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-1">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                disabled={disabled || qty === null || qty <= 1}
                                                onClick={() => onQuantityChange(product.id, String((qty ?? 2) - 1))}
                                                aria-label={`One less ${label}`}
                                                className="h-11 w-11"
                                            >
                                                <Minus className="h-4 w-4" aria-hidden="true" />
                                            </Button>
                                            <Label htmlFor={inputId} className="sr-only">
                                                Quantity of {label}
                                            </Label>
                                            <Input
                                                id={inputId}
                                                inputMode="numeric"
                                                autoComplete="off"
                                                value={line.quantity}
                                                disabled={disabled}
                                                onChange={(e) => onQuantityChange(product.id, e.target.value)}
                                                aria-invalid={Boolean(lineError)}
                                                aria-describedby={lineError ? `${inputId}-error` : undefined}
                                                className="h-11 w-16 text-center"
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                disabled={disabled || qty === null || qty >= product.quantity}
                                                onClick={() => onQuantityChange(product.id, String((qty ?? 0) + 1))}
                                                aria-label={`One more ${label}`}
                                                className="h-11 w-11"
                                            >
                                                <Plus className="h-4 w-4" aria-hidden="true" />
                                            </Button>
                                        </div>
                                        <p className="text-sm font-medium">
                                            {qty !== null ? formatter.format(Number(product.price) * qty) : "—"}
                                        </p>
                                    </div>
                                    {lineError && (
                                        <p id={`${inputId}-error`} className="text-sm font-medium text-destructive">
                                            {lineError}
                                        </p>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
                {error && (
                    <p id="product-search-error" className="text-sm font-medium text-destructive">
                        {error}
                    </p>
                )}
            </div>
        </div>
    );
}
