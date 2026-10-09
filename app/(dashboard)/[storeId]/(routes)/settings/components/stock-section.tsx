"use client";

import axios from "axios";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
    MAX_LOW_STOCK_THRESHOLD,
    MIN_LOW_STOCK_THRESHOLD,
    STOCK_DISPLAY_MODES,
    parseLowStockThreshold,
    type StockDisplayModeValue,
    type StockSettings,
} from "@/lib/stock";

interface StockSectionProps {
    storeId: string;
    /** The saved settings, in the merchant API shape. */
    initialSettings: StockSettings;
}

// What each mode looks like on a product (illustrative quantities).
const EXAMPLES: Record<StockDisplayModeValue, string> = {
    ALWAYS: "“12 in stock” (and “Only 3 left” when low)",
    WHEN_LOW: "“Only 3 left”",
    NEVER: "Shoppers don't see stock numbers",
};

// The live "Shoppers see" line, from the current choices.
const shopperSummary = (mode: StockDisplayModeValue, threshold: number | null) => {
    const low = threshold === null ? "when stock is low" : `at ${threshold} or fewer`;

    switch (mode) {
        case "ALWAYS":
            return `“Only N left” ${low}, otherwise “N in stock”.`;
        case "WHEN_LOW":
            return `“Only N left” ${low}, otherwise no stock number.`;
        case "NEVER":
            return "No stock numbers.";
    }
};

export function StockSection({ storeId, initialSettings }: StockSectionProps) {
    const router = useRouter();
    const [threshold, setThreshold] = useState(String(initialSettings.lowStockThreshold));
    const [mode, setMode] = useState<StockDisplayModeValue>(initialSettings.stockDisplayMode);
    const [dirty, setDirty] = useState(false);
    const [loading, setLoading] = useState(false);

    // Same rule as the server (lib/stock.ts), so the message matches its 400.
    const parsed = parseLowStockThreshold(threshold);
    const error = "error" in parsed ? parsed.error : null;

    const save = async () => {
        if (error) return;

        try {
            setLoading(true);
            const { data } = await axios.patch<StockSettings>(`/api/stores/${storeId}/stock-settings`, {
                lowStockThreshold: threshold,
                stockDisplayMode: mode,
            });
            setThreshold(String(data.lowStockThreshold));
            setMode(data.stockDisplayMode);
            setDirty(false);
            router.refresh();
            toast.success("Stock settings saved.");
        } catch (err: any) {
            const text = err?.response?.data;
            toast.error(
                err?.response?.status === 400 && typeof text === "string" && text
                    ? text
                    : "Something went wrong.",
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-w-0 space-y-4">
            <Heading
                title="Stock"
                description="Choose what shoppers see about stock, and when a product counts as low."
            />
            <Separator />
            <form
                noValidate
                className="min-w-0 space-y-6"
                onSubmit={(e) => {
                    e.preventDefault();
                    save();
                }}
            >
                <div className="min-w-0 space-y-2 md:max-w-sm">
                    <Label htmlFor="low-stock-threshold">Low-stock threshold</Label>
                    <Input
                        id="low-stock-threshold"
                        type="number"
                        inputMode="numeric"
                        min={MIN_LOW_STOCK_THRESHOLD}
                        max={MAX_LOW_STOCK_THRESHOLD}
                        step={1}
                        disabled={loading}
                        value={threshold}
                        onChange={(e) => {
                            setThreshold(e.target.value);
                            setDirty(true);
                        }}
                        aria-invalid={dirty && Boolean(error)}
                        aria-describedby="low-stock-threshold-hint"
                    />
                    <p id="low-stock-threshold-hint" className="text-sm text-muted-foreground">
                        Products at or below this number count as low. You can change it per product.
                    </p>
                </div>

                <fieldset className="min-w-0 space-y-2" disabled={loading}>
                    <legend className="mb-2 text-sm font-medium">Show stock to shoppers</legend>
                    <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-3">
                        {STOCK_DISPLAY_MODES.map((option) => (
                            <label
                                key={option.value}
                                className={`flex min-w-0 cursor-pointer items-start gap-3 rounded-md border p-3 ${mode === option.value ? "border-primary ring-1 ring-primary" : ""}`}
                            >
                                <input
                                    type="radio"
                                    name="stock-display-mode"
                                    value={option.value}
                                    checked={mode === option.value}
                                    onChange={() => {
                                        setMode(option.value);
                                        setDirty(true);
                                    }}
                                    className="mt-1 h-4 w-4 shrink-0"
                                />
                                <span className="min-w-0">
                                    <span className="block text-sm font-medium">{option.label}</span>
                                    <span className="block text-sm text-muted-foreground">
                                        {EXAMPLES[option.value]}
                                    </span>
                                </span>
                            </label>
                        ))}
                    </div>
                </fieldset>

                <div className="min-w-0 space-y-2">
                    {dirty && error ? (
                        <p role="alert" className="text-sm font-medium text-destructive">
                            {error}
                        </p>
                    ) : null}
                    <p className="rounded-md bg-muted/50 px-3 py-2 text-sm" aria-live="polite">
                        <span className="font-medium">Shoppers see:</span>{" "}
                        {shopperSummary(mode, "error" in parsed ? null : parsed.value)}
                    </p>
                </div>

                <Button type="submit" disabled={loading || Boolean(error)} className="w-full sm:w-auto">
                    Save
                </Button>
            </form>
        </div>
    );
}
