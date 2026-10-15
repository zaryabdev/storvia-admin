"use client";

import axios from "axios";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { getDeliveryOptions, type DeliverySettings } from "@/lib/delivery";
import { previewOrderTotals, type ManualOrderResponse } from "@/lib/manual-order";
import { customerFieldError } from "@/lib/order-customer";
import { PAYMENT_RECEIVED_VIA, type CheckoutPaymentMethod, type PaymentReceivedViaValue } from "@/lib/order-payment";
import { formatDeliveryFee } from "@/lib/order-template";
import { OTHER_CITY, cityName } from "@/lib/pakistan-cities";
import { formatter } from "@/lib/utils";

import { OrderCreated, type WhatsAppContext } from "./order-created";
import { ProductPicker, lineQuantity, type NewOrderProduct, type OrderLine } from "./product-picker";

export type { NewOrderProduct };

type FieldKey = "name" | "phone" | "email" | "line1" | "line2" | "postalCode" | "notes" | "cityKey";
type Values = Record<FieldKey, string>;

const EMPTY_VALUES: Values = {
    name: "",
    phone: "",
    email: "",
    line1: "",
    line2: "",
    postalCode: "",
    notes: "",
    cityKey: "",
};

const PAID_VIA_MESSAGE = "Choose how you received the money.";
const NO_ITEMS_MESSAGE = "Add at least one item.";

interface NewOrderFormProps {
    storeId: string;
    products: NewOrderProduct[];
    delivery: DeliverySettings;
    bankTransferAvailable: boolean;
    whatsapp: WhatsAppContext;
}

// The server's message for a failed create: plain text, or { message } JSON.
function serverMessage(error: any): string {
    const status = error?.response?.status;
    const data = error?.response?.data;

    if (status === 401 || status === 403) return "You don't have access to this store.";
    if (status >= 400 && status < 500) {
        if (typeof data === "string" && data) return data;
        if (data && typeof data.message === "string" && data.message) return data.message;
    }
    return "Something went wrong. Please try again.";
}

export function NewOrderForm({ storeId, products, delivery, bankTransferAvailable, whatsapp }: NewOrderFormProps) {
    const router = useRouter();
    const options = getDeliveryOptions(delivery);
    const initialValues: Values = { ...EMPTY_VALUES, cityKey: options.lockedCityKey ?? "" };

    const [values, setValues] = useState<Values>(initialValues);
    const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
    const [lines, setLines] = useState<OrderLine[]>([]);
    const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMethod>("COD");
    const [alreadyPaid, setAlreadyPaid] = useState(false);
    const [receivedVia, setReceivedVia] = useState<PaymentReceivedViaValue | "">("");
    const [confirm, setConfirm] = useState(false);
    const [attempted, setAttempted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);
    const [created, setCreated] = useState<ManualOrderResponse | null>(null);

    // Guards a second submit before the disabled state renders (no double orders).
    const submittingRef = useRef(false);
    const bannerRef = useRef<HTMLDivElement>(null);
    const formRef = useRef<HTMLFormElement>(null);

    const productsById = new Map(products.map((product) => [product.id, product]));
    const selectedCityName = values.cityKey ? cityName(values.cityKey) ?? "" : "";

    // Inline errors use the server's own rules and messages (lib/order-customer.ts).
    const errors: Partial<Record<FieldKey | "items" | "paidVia", string>> = {};
    const nameError = customerFieldError("name", values.name);
    const phoneError = customerFieldError("phone", values.phone);
    const line1Error = customerFieldError("line1", values.line1);
    const cityError = customerFieldError("city", selectedCityName, values.cityKey);
    if (nameError) errors.name = nameError;
    if (phoneError) errors.phone = phoneError;
    if (line1Error) errors.line1 = line1Error;
    if (cityError) errors.cityKey = cityError;
    if (lines.length === 0) errors.items = NO_ITEMS_MESSAGE;
    const payingByBank = paymentMethod === "BANK_TRANSFER";
    if (payingByBank && alreadyPaid && !receivedVia) errors.paidVia = PAID_VIA_MESSAGE;

    const lineValues = lines.map((line) => {
        const product = productsById.get(line.productId);
        return product ? lineQuantity(line.quantity, product.quantity) : { error: "Unavailable" };
    });
    const linesValid = lineValues.every((parsed) => "value" in parsed);
    const isValid = Object.keys(errors).length === 0 && linesValid;

    const showError = (key: FieldKey | "items" | "paidVia") =>
        (attempted || touched[key as FieldKey]) && errors[key] ? errors[key] : null;

    // Summary preview: listed prices and the same delivery rules as the server.
    const preview = previewOrderTotals(
        lines.flatMap((line, index) => {
            const product = productsById.get(line.productId);
            const parsed = lineValues[index];
            return product && "value" in parsed ? [{ price: product.price, quantity: parsed.value }] : [];
        }),
        delivery,
        values.cityKey || null,
    );

    const setField = (key: FieldKey, value: string) => setValues((prev) => ({ ...prev, [key]: value }));
    const touch = (key: FieldKey) => setTouched((prev) => ({ ...prev, [key]: true }));

    const addProduct = (productId: string) => {
        const product = productsById.get(productId);
        if (!product || product.quantity <= 0) return;

        setLines((prev) => {
            const existing = prev.find((line) => line.productId === productId);
            if (!existing) return [...prev, { productId, quantity: "1" }];

            const current = Number(existing.quantity) || 0;
            const next = Math.min(Math.max(current, 0) + 1, product.quantity);
            return prev.map((line) => (line.productId === productId ? { ...line, quantity: String(next) } : line));
        });
    };

    const reset = () => {
        setValues(initialValues);
        setTouched({});
        setLines([]);
        setPaymentMethod("COD");
        setAlreadyPaid(false);
        setReceivedVia("");
        setConfirm(false);
        setAttempted(false);
        setServerError(null);
        setCreated(null);
        window.scrollTo({ top: 0 });
    };

    const submit = async () => {
        if (submittingRef.current) return;

        if (!isValid) {
            setAttempted(true);
            // Focus the first field with an error (DOM order).
            requestAnimationFrame(() => {
                formRef.current
                    ?.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid="true"]')
                    ?.focus();
            });
            return;
        }

        submittingRef.current = true;
        setSubmitting(true);
        setServerError(null);

        try {
            const { data } = await axios.post<ManualOrderResponse>(`/api/${storeId}/orders`, {
                items: lines.map((line, index) => ({
                    productId: line.productId,
                    quantity: (lineValues[index] as { value: number }).value,
                })),
                customer: { name: values.name, phone: values.phone, email: values.email },
                shipping: {
                    line1: values.line1,
                    line2: values.line2,
                    city: selectedCityName,
                    cityKey: values.cityKey,
                    postalCode: values.postalCode,
                    country: "PK",
                },
                notes: values.notes,
                paymentMethod,
                confirm,
                paid: payingByBank && alreadyPaid && receivedVia ? { receivedVia } : null,
            });

            setCreated(data);
            window.scrollTo({ top: 0 });
            // The Orders list, Customers and dashboard read fresh data next time.
            router.refresh();
        } catch (error) {
            setServerError(serverMessage(error));
            requestAnimationFrame(() => {
                bannerRef.current?.scrollIntoView({ block: "center" });
                bannerRef.current?.focus();
            });
        } finally {
            submittingRef.current = false;
            setSubmitting(false);
        }
    };

    if (created) {
        return <OrderCreated storeId={storeId} order={created} whatsapp={whatsapp} onCreateAnother={reset} />;
    }

    const textField = (
        key: FieldKey,
        label: string,
        props: React.InputHTMLAttributes<HTMLInputElement> = {},
        hint?: string,
    ) => {
        const id = `order-${key}`;
        const error = showError(key);
        const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ");

        return (
            <div className="min-w-0 space-y-2">
                <Label htmlFor={id}>{label}</Label>
                <Input
                    id={id}
                    value={values[key]}
                    disabled={submitting}
                    onChange={(e) => setField(key, e.target.value)}
                    onBlur={() => touch(key)}
                    aria-invalid={Boolean(error)}
                    aria-describedby={describedBy || undefined}
                    className="h-11"
                    {...props}
                />
                {hint && (
                    <p id={`${id}-hint`} className="text-xs text-muted-foreground">
                        {hint}
                    </p>
                )}
                {error && (
                    <p id={`${id}-error`} className="text-sm font-medium text-destructive">
                        {error}
                    </p>
                )}
            </div>
        );
    };

    const cityFieldError = showError("cityKey");
    const paidViaError = showError("paidVia");
    const section = "min-w-0 space-y-4 rounded-2xl border p-4 sm:p-6";

    return (
        <div className="mx-auto w-full max-w-2xl min-w-0 space-y-4">
            <Button asChild variant="ghost" className="-ml-3 min-h-[44px]">
                <Link href={`/${storeId}/orders`}>
                    <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                    Orders
                </Link>
            </Button>
            <Heading title="New order" description="Create an order you took by phone, WhatsApp or in person." />
            <Separator />

            {serverError && (
                <div
                    ref={bannerRef}
                    role="alert"
                    tabIndex={-1}
                    className="break-words rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive outline-none [overflow-wrap:anywhere]"
                >
                    {serverError}
                </div>
            )}

            <form
                ref={formRef}
                noValidate
                className="min-w-0 space-y-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    submit();
                }}
            >
                <section className={section} aria-labelledby="order-customer-heading">
                    <h2 id="order-customer-heading" className="text-base font-semibold">
                        Customer
                    </h2>
                    {textField("name", "Name", { autoComplete: "off" })}
                    {textField("phone", "Phone", {
                        type: "tel",
                        inputMode: "tel",
                        autoComplete: "off",
                        placeholder: "0300 1234567",
                    })}
                    {textField("email", "Email (optional)", { type: "email", inputMode: "email", autoComplete: "off" })}
                </section>

                <section className={section} aria-labelledby="order-delivery-heading">
                    <h2 id="order-delivery-heading" className="text-base font-semibold">
                        Delivery
                    </h2>
                    <div className="min-w-0 space-y-2">
                        {options.lockedCityKey ? (
                            <>
                                <p className="text-sm font-medium">City</p>
                                <p className="text-sm">Delivering to {cityName(options.lockedCityKey)}</p>
                            </>
                        ) : (
                            <>
                                <Label htmlFor="order-cityKey">City</Label>
                                <select
                                    id="order-cityKey"
                                    value={values.cityKey}
                                    disabled={submitting}
                                    onChange={(e) => setField("cityKey", e.target.value)}
                                    onBlur={() => touch("cityKey")}
                                    aria-invalid={Boolean(cityFieldError)}
                                    aria-describedby={cityFieldError ? "order-cityKey-error" : undefined}
                                    className="flex h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <option value="">Choose a city</option>
                                    {options.cities.map((city) => (
                                        <option key={city.key} value={city.key}>
                                            {city.name}
                                        </option>
                                    ))}
                                    {options.otherCityAllowed && <option value={OTHER_CITY.key}>{OTHER_CITY.name}</option>}
                                </select>
                                {cityFieldError && (
                                    <p id="order-cityKey-error" className="text-sm font-medium text-destructive">
                                        {cityFieldError}
                                    </p>
                                )}
                            </>
                        )}
                    </div>
                    {textField(
                        "line1",
                        "Address line 1",
                        { autoComplete: "off" },
                        values.cityKey === OTHER_CITY.key ? "Include the town or area in the address." : undefined,
                    )}
                    {textField("line2", "Address line 2 (optional)", { autoComplete: "off" })}
                    {textField("postalCode", "Postal code (optional)", { inputMode: "numeric", autoComplete: "off" })}
                    <div className="min-w-0 space-y-2">
                        <Label htmlFor="order-notes">Delivery notes (optional)</Label>
                        <textarea
                            id="order-notes"
                            rows={3}
                            dir="auto"
                            value={values.notes}
                            disabled={submitting}
                            onChange={(e) => setField("notes", e.target.value)}
                            className="flex w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                    </div>
                </section>

                <section className={section} aria-labelledby="order-items-heading">
                    <h2 id="order-items-heading" className="text-base font-semibold">
                        Items
                    </h2>
                    <ProductPicker
                        products={products}
                        lines={lines}
                        disabled={submitting}
                        error={attempted ? errors.items ?? null : null}
                        showLineErrors
                        onAdd={addProduct}
                        onQuantityChange={(productId, quantity) =>
                            setLines((prev) =>
                                prev.map((line) => (line.productId === productId ? { ...line, quantity } : line)),
                            )
                        }
                        onRemove={(productId) => setLines((prev) => prev.filter((line) => line.productId !== productId))}
                    />
                </section>

                <section className={section} aria-labelledby="order-payment-heading">
                    <h2 id="order-payment-heading" className="text-base font-semibold">
                        Payment
                    </h2>
                    <fieldset className="min-w-0 space-y-3" disabled={submitting}>
                        <legend className="sr-only">Payment method</legend>
                        {(
                            [
                                { value: "COD", label: "Cash on delivery", help: "The rider collects the total." },
                                ...(bankTransferAvailable
                                    ? [
                                          {
                                              value: "BANK_TRANSFER",
                                              label: "Bank transfer",
                                              help: "Bank, Raast, JazzCash or Easypaisa, paid to you directly.",
                                          },
                                      ]
                                    : []),
                            ] as Array<{ value: CheckoutPaymentMethod; label: string; help: string }>
                        ).map((option) => (
                            <label
                                key={option.value}
                                className={`flex min-h-[44px] min-w-0 cursor-pointer items-start gap-3 rounded-md border p-3 ${paymentMethod === option.value ? "border-primary ring-1 ring-primary" : ""}`}
                            >
                                <input
                                    type="radio"
                                    name="order-payment-method"
                                    value={option.value}
                                    checked={paymentMethod === option.value}
                                    onChange={() => setPaymentMethod(option.value)}
                                    className="mt-1 h-4 w-4 shrink-0"
                                />
                                <span className="min-w-0">
                                    <span className="block text-sm font-medium">{option.label}</span>
                                    <span className="block text-sm text-muted-foreground">{option.help}</span>
                                </span>
                            </label>
                        ))}
                        {!bankTransferAvailable && (
                            <p className="text-xs text-muted-foreground">
                                Bank transfer is off. Turn it on and add an account in Settings → Payments to use it.
                            </p>
                        )}
                    </fieldset>

                    {payingByBank && (
                        <div className="min-w-0 space-y-3">
                            <label className="flex min-h-[44px] cursor-pointer items-center gap-3">
                                <input
                                    type="checkbox"
                                    checked={alreadyPaid}
                                    disabled={submitting}
                                    onChange={(e) => setAlreadyPaid(e.target.checked)}
                                    className="h-4 w-4 shrink-0"
                                />
                                <span className="text-sm font-medium">Already paid</span>
                            </label>
                            {alreadyPaid && (
                                <fieldset
                                    className="min-w-0 space-y-2"
                                    disabled={submitting}
                                    aria-describedby={paidViaError ? "order-paid-via-error" : undefined}
                                >
                                    <legend className="mb-2 text-sm font-medium">How did you receive the money?</legend>
                                    {PAYMENT_RECEIVED_VIA.map((option) => (
                                        <label
                                            key={option.value}
                                            className="flex min-h-[44px] min-w-0 cursor-pointer items-center gap-3 rounded-md border px-3"
                                        >
                                            <input
                                                type="radio"
                                                name="order-paid-via"
                                                value={option.value}
                                                checked={receivedVia === option.value}
                                                onChange={() => setReceivedVia(option.value)}
                                                data-invalid={paidViaError ? "true" : undefined}
                                                className="h-4 w-4 shrink-0"
                                            />
                                            <span className="text-sm">{option.label}</span>
                                        </label>
                                    ))}
                                    {paidViaError && (
                                        <p id="order-paid-via-error" className="text-sm font-medium text-destructive">
                                            {paidViaError}
                                        </p>
                                    )}
                                </fieldset>
                            )}
                        </div>
                    )}
                </section>

                <section className={section} aria-labelledby="order-summary-heading">
                    <h2 id="order-summary-heading" className="text-base font-semibold">
                        Summary
                    </h2>
                    <dl className="space-y-2 text-sm">
                        <div className="flex min-w-0 justify-between gap-4">
                            <dt className="text-muted-foreground">Subtotal</dt>
                            <dd className="text-right">{formatter.format(Number(preview.subtotal))}</dd>
                        </div>
                        <div className="flex min-w-0 justify-between gap-4">
                            <dt className="text-muted-foreground">Delivery</dt>
                            <dd className="text-right">
                                {preview.deliveryFee === null ? "Choose a city" : formatDeliveryFee(preview.deliveryFee)}
                            </dd>
                        </div>
                        <div className="flex min-w-0 justify-between gap-4 border-t pt-2 font-semibold">
                            <dt>Total</dt>
                            <dd className="text-right">
                                {preview.total === null ? "—" : formatter.format(Number(preview.total))}
                            </dd>
                        </div>
                    </dl>
                    <p className="text-xs text-muted-foreground">
                        Prices, stock and delivery are checked again when you create the order.
                    </p>

                    <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-md border p-3">
                        <input
                            type="checkbox"
                            checked={confirm}
                            disabled={submitting}
                            onChange={(e) => setConfirm(e.target.checked)}
                            aria-describedby="order-confirm-hint"
                            className="mt-1 h-4 w-4 shrink-0"
                        />
                        <span className="min-w-0">
                            <span className="block text-sm font-medium">Create as confirmed</span>
                            <span id="order-confirm-hint" className="block text-sm text-muted-foreground">
                                Stock is reduced now. Use this if you&apos;ve already confirmed the order with the
                                customer.
                            </span>
                        </span>
                    </label>

                    <Button type="submit" disabled={submitting} className="min-h-[44px] w-full">
                        {submitting ? "Creating order…" : "Create order"}
                    </Button>
                </section>
            </form>
        </div>
    );
}
