"use client";

import axios from "axios";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
    MAX_DELIVERY_DAYS,
    formatDeliveryDays,
    normalizeDeliverySettings,
    type DeliveryAreaValue,
    type MerchantDeliveryBody,
} from "@/lib/delivery";
import { PAKISTAN_CITIES } from "@/lib/pakistan-cities";
import { formatter } from "@/lib/utils";

interface DeliverySectionProps {
    storeId: string;
    /** The saved settings, in the merchant API shape. */
    initialSettings: MerchantDeliveryBody;
}

type CityState = Record<string, { selected: boolean; fee: string }>;

interface FormState {
    area: DeliveryAreaValue;
    defaultFee: string;
    threshold: string;
    daysMin: string;
    daysMax: string;
    cities: CityState;
}

const toForm = (settings: MerchantDeliveryBody): FormState => ({
    area: settings.area,
    defaultFee: settings.defaultFee,
    threshold: settings.freeDeliveryThreshold ?? "",
    daysMin: String(settings.daysMin),
    daysMax: String(settings.daysMax),
    cities: Object.fromEntries(
        settings.cities.map((city) => [city.key, { selected: city.selected, fee: city.fee ?? "" }]),
    ),
});

// The request body: the same object the server validates.
const toBody = (form: FormState) => ({
    area: form.area,
    defaultFee: form.defaultFee,
    freeDeliveryThreshold: form.threshold,
    daysMin: form.daysMin,
    daysMax: form.daysMax,
    cities: PAKISTAN_CITIES.map(({ key }) => ({
        key,
        selected: form.cities[key]?.selected ?? false,
        fee: form.cities[key]?.fee ?? "",
    })),
});

// Display only: "Rs 3,000".
const rupees = (value: string) => formatter.format(Number(value));

const AREAS: { value: DeliveryAreaValue; label: string; help: string }[] = [
    {
        value: "ALL_PAKISTAN",
        label: "All of Pakistan",
        help: "Customers pick one of the main cities or “Other city”.",
    },
    {
        value: "SELECTED_CITIES",
        label: "Selected cities only",
        help: "Customers can only pick the cities you tick below.",
    },
];

export function DeliverySection({ storeId, initialSettings }: DeliverySectionProps) {
    const router = useRouter();
    const [form, setForm] = useState<FormState>(() => toForm(initialSettings));
    const [dirty, setDirty] = useState(false);
    const [loading, setLoading] = useState(false);

    // Same rules as the server (lib/delivery.ts), so the message matches its 400.
    const result = useMemo(() => normalizeDeliverySettings(toBody(form)), [form]);
    const error = "error" in result ? result.error : null;

    const update = (patch: Partial<FormState>) => {
        setForm((prev) => ({ ...prev, ...patch }));
        setDirty(true);
    };

    const updateCity = (key: string, patch: Partial<CityState[string]>) => {
        setForm((prev) => ({
            ...prev,
            cities: { ...prev.cities, [key]: { ...prev.cities[key], ...patch } },
        }));
        setDirty(true);
    };

    const summary = (() => {
        if ("error" in result) return null;

        const settings = result.value;
        const days = formatDeliveryDays(settings.daysMin, settings.daysMax);
        const parts =
            settings.defaultFee === "0"
                ? ["Free delivery"]
                : [
                      `Delivery ${rupees(settings.defaultFee)}${settings.cities.some((city) => city.fee !== null) ? " (some cities differ)" : ""}`,
                      ...(settings.freeDeliveryThreshold
                          ? [`Free over ${rupees(settings.freeDeliveryThreshold)}`]
                          : []),
                  ];

        return [...parts, `Delivery in ${days} ${days === "1" ? "day" : "days"}`].join(" · ");
    })();

    const save = async () => {
        if (error) return;

        try {
            setLoading(true);
            const { data } = await axios.patch<MerchantDeliveryBody>(
                `/api/stores/${storeId}/delivery-settings`,
                toBody(form),
            );
            setForm(toForm(data));
            setDirty(false);
            router.refresh();
            toast.success("Delivery settings saved.");
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

    const selectedMode = form.area === "SELECTED_CITIES";
    const defaultFeeLabel = /^\d+(\.\d+)?$/.test(form.defaultFee.trim()) ? rupees(form.defaultFee) : "the default";

    return (
        <div className="min-w-0 space-y-4">
            <Heading
                title="Delivery"
                description="Where you deliver, what customers pay for delivery, and how long it takes."
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
                <fieldset className="min-w-0 space-y-2" disabled={loading}>
                    <legend className="mb-2 text-sm font-medium">Delivery area</legend>
                    <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
                        {AREAS.map((option) => (
                            <label
                                key={option.value}
                                className={`flex min-w-0 cursor-pointer items-start gap-3 rounded-md border p-3 ${form.area === option.value ? "border-primary ring-1 ring-primary" : ""}`}
                            >
                                <input
                                    type="radio"
                                    name="delivery-area"
                                    value={option.value}
                                    checked={form.area === option.value}
                                    onChange={() => update({ area: option.value })}
                                    className="mt-1 h-4 w-4 shrink-0"
                                />
                                <span className="min-w-0">
                                    <span className="block text-sm font-medium">{option.label}</span>
                                    <span className="block text-sm text-muted-foreground">{option.help}</span>
                                </span>
                            </label>
                        ))}
                    </div>
                </fieldset>

                <div className="grid min-w-0 grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="min-w-0 space-y-2">
                        <Label htmlFor="delivery-fee">Default delivery fee (Rs)</Label>
                        <Input
                            id="delivery-fee"
                            inputMode="decimal"
                            disabled={loading}
                            value={form.defaultFee}
                            onChange={(e) => update({ defaultFee: e.target.value })}
                            aria-describedby="delivery-fee-hint"
                        />
                        <p id="delivery-fee-hint" className="text-sm text-muted-foreground">
                            Set 0 for free delivery.
                        </p>
                    </div>
                    <div className="min-w-0 space-y-2">
                        <Label htmlFor="delivery-threshold">Free delivery over (optional) (Rs)</Label>
                        <Input
                            id="delivery-threshold"
                            inputMode="decimal"
                            placeholder="No free-delivery amount"
                            disabled={loading}
                            value={form.threshold}
                            onChange={(e) => update({ threshold: e.target.value })}
                            aria-describedby="delivery-threshold-hint"
                        />
                        <p id="delivery-threshold-hint" className="text-sm text-muted-foreground">
                            Delivery is free when the items total reaches this amount.
                        </p>
                    </div>
                </div>

                <fieldset className="min-w-0 space-y-2" disabled={loading}>
                    <legend className="mb-2 text-sm font-medium">Delivery time (days)</legend>
                    <div className="grid min-w-0 grid-cols-2 gap-4 md:max-w-sm">
                        <div className="min-w-0 space-y-2">
                            <Label htmlFor="delivery-days-min">Min days</Label>
                            <Input
                                id="delivery-days-min"
                                type="number"
                                inputMode="numeric"
                                min={0}
                                max={MAX_DELIVERY_DAYS}
                                step={1}
                                value={form.daysMin}
                                onChange={(e) => update({ daysMin: e.target.value })}
                            />
                        </div>
                        <div className="min-w-0 space-y-2">
                            <Label htmlFor="delivery-days-max">Max days</Label>
                            <Input
                                id="delivery-days-max"
                                type="number"
                                inputMode="numeric"
                                min={0}
                                max={MAX_DELIVERY_DAYS}
                                step={1}
                                value={form.daysMax}
                                onChange={(e) => update({ daysMax: e.target.value })}
                            />
                        </div>
                    </div>
                </fieldset>

                <fieldset className="min-w-0 space-y-3" disabled={loading}>
                    <legend className="mb-1 text-sm font-medium">
                        {selectedMode ? "Cities you deliver to" : "City fees (optional)"}
                    </legend>
                    <p className="text-sm text-muted-foreground">
                        {selectedMode
                            ? "Tick each city you deliver to. Leave a fee empty to use the default fee."
                            : "Leave empty to use the default fee. Other cities always use the default fee."}
                    </p>
                    <ul className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                        {PAKISTAN_CITIES.map(({ key, name }) => {
                            const city = form.cities[key] ?? { selected: false, fee: "" };
                            const feeId = `delivery-city-fee-${key}`;
                            const feeDisabled = selectedMode && !city.selected;

                            return (
                                <li key={key} className="flex min-w-0 items-center gap-3 rounded-md border p-2">
                                    {selectedMode ? (
                                        <label className="flex min-h-[40px] min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={city.selected}
                                                onChange={(e) => updateCity(key, { selected: e.target.checked })}
                                                className="h-4 w-4 shrink-0"
                                            />
                                            <span className="truncate">{name}</span>
                                        </label>
                                    ) : (
                                        <label htmlFor={feeId} className="min-w-0 flex-1 truncate text-sm">
                                            {name}
                                        </label>
                                    )}
                                    <Input
                                        id={feeId}
                                        inputMode="decimal"
                                        aria-label={`Delivery fee for ${name} (Rs)`}
                                        placeholder={`Default (${defaultFeeLabel})`}
                                        disabled={loading || feeDisabled}
                                        value={city.fee}
                                        onChange={(e) => updateCity(key, { fee: e.target.value })}
                                        className="w-32 shrink-0 sm:w-36"
                                    />
                                </li>
                            );
                        })}
                    </ul>
                </fieldset>

                <div className="min-w-0 space-y-2">
                    {dirty && error ? (
                        <p role="alert" className="text-sm font-medium text-destructive">
                            {error}
                        </p>
                    ) : summary ? (
                        <p className="rounded-md bg-muted/50 px-3 py-2 text-sm" aria-live="polite">
                            <span className="font-medium">Customers see:</span> {summary}
                        </p>
                    ) : null}
                </div>

                <Button type="submit" disabled={loading || Boolean(error)} className="w-full sm:w-auto">
                    Save delivery settings
                </Button>
            </form>
        </div>
    );
}
