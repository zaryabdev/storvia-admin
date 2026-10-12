"use client";

import axios from "axios";
import { ChevronDown, ChevronUp, Plus, Trash } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import ImageUpload from "@/components/ui/image-upload";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
    MAX_ACCOUNT_NOTE_LENGTH,
    MAX_PAYMENT_ACCOUNTS,
    PAYMENT_ACCOUNT_TYPES,
    PAYMENT_ACCOUNT_TYPE_LABELS,
    formatIban,
    normalizeIban,
    normalizePaymentSettings,
    paymentAccountError,
    type PaymentAccountTypeValue,
    type PaymentSettingsBody,
} from "@/lib/payment-accounts";

interface PaymentsSectionProps {
    storeId: string;
    /** The saved settings, in the merchant API shape. */
    initialSettings: PaymentSettingsBody;
}

const FIELDS = [
    "accountTitle",
    "bankName",
    "iban",
    "accountNumber",
    "raastId",
    "walletNumber",
    "tillId",
    "qrImageUrl",
    "note",
] as const;
type Field = (typeof FIELDS)[number];

// One account in the form: every field as text ("" = empty); `key` is local.
type FormAccount = { key: string; type: PaymentAccountTypeValue } & Record<Field, string>;

interface FormState {
    enabled: boolean;
    accounts: FormAccount[];
}

let nextKey = 0;
const newKey = () => `new-${++nextKey}`;

const emptyAccount = (type: PaymentAccountTypeValue): FormAccount => ({
    key: newKey(),
    type,
    ...(Object.fromEntries(FIELDS.map((field) => [field, ""])) as Record<Field, string>),
});

const toForm = (settings: PaymentSettingsBody): FormState => ({
    enabled: settings.enabled,
    accounts: settings.accounts.map((account) => ({
        key: account.id,
        type: account.type,
        ...(Object.fromEntries(FIELDS.map((field) => [field, account[field] ?? ""])) as Record<Field, string>),
    })),
});

// The request body for one account: only its type's fields, so the server's
// "must be empty" rules never trip on hidden inputs.
const toAccountBody = (account: FormAccount) =>
    account.type === "BANK"
        ? {
              type: account.type,
              accountTitle: account.accountTitle,
              bankName: account.bankName,
              iban: account.iban,
              accountNumber: account.accountNumber,
              raastId: account.raastId,
              qrImageUrl: account.qrImageUrl,
              note: account.note,
          }
        : {
              type: account.type,
              accountTitle: account.accountTitle,
              walletNumber: account.walletNumber,
              tillId: account.tillId,
              qrImageUrl: account.qrImageUrl,
              note: account.note,
          };

// The same object the server validates.
const toBody = (form: FormState) => ({
    enabled: form.enabled,
    accounts: form.accounts.map(toAccountBody),
});

// "Meezan Bank · Ali Raza" / "JazzCash · Ali Raza", for card text and aria-labels.
const accountName = (account: FormAccount) =>
    [
        account.type === "BANK" ? account.bankName.trim() || "Bank account" : PAYMENT_ACCOUNT_TYPE_LABELS[account.type],
        account.accountTitle.trim(),
    ]
        .filter(Boolean)
        .join(" · ");

const TEXTAREA_CLASS =
    "flex min-h-[80px] w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export function PaymentsSection({ storeId, initialSettings }: PaymentsSectionProps) {
    const router = useRouter();
    const [form, setForm] = useState<FormState>(() => toForm(initialSettings));
    // The account whose fields are open (new accounts open automatically).
    const [expanded, setExpanded] = useState<string | null>(null);
    const [dirty, setDirty] = useState(false);
    const [loading, setLoading] = useState(false);

    // Same rules as the server (lib/payment-accounts.ts), so the message matches its 400.
    const result = useMemo(() => normalizePaymentSettings(toBody(form)), [form]);
    const error = "error" in result ? result.error : null;

    const change = (updater: (prev: FormState) => FormState) => {
        setForm(updater);
        setDirty(true);
    };

    const updateAccount = (key: string, field: Field, value: string) =>
        change((prev) => ({
            ...prev,
            accounts: prev.accounts.map((account) => (account.key === key ? { ...account, [field]: value } : account)),
        }));

    const addAccount = (type: PaymentAccountTypeValue) => {
        const account = emptyAccount(type);
        change((prev) => ({ ...prev, accounts: [...prev.accounts, account] }));
        setExpanded(account.key);
    };

    const moveAccount = (index: number, delta: -1 | 1) =>
        change((prev) => {
            const accounts = [...prev.accounts];
            const target = index + delta;
            if (target < 0 || target >= accounts.length) return prev;
            [accounts[index], accounts[target]] = [accounts[target], accounts[index]];
            return { ...prev, accounts };
        });

    const removeAccount = (key: string) => {
        change((prev) => ({ ...prev, accounts: prev.accounts.filter((account) => account.key !== key) }));
        if (expanded === key) setExpanded(null);
    };

    const save = async () => {
        if (error) return;

        try {
            setLoading(true);
            const { data } = await axios.put<PaymentSettingsBody>(
                `/api/stores/${storeId}/payment-settings`,
                toBody(form),
            );
            setForm(toForm(data));
            setExpanded(null);
            setDirty(false);
            router.refresh();
            toast.success("Payment settings saved.");
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

    const full = form.accounts.length >= MAX_PAYMENT_ACCOUNTS;

    return (
        <div className="min-w-0 space-y-4">
            <Heading
                title="Payments"
                description="Cash on Delivery is always available. You can also let customers pay you directly by bank transfer, JazzCash or Easypaisa."
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
                <div className="min-w-0 space-y-2">
                    <div className="flex min-h-[44px] items-center gap-3">
                        <Switch
                            id="bank-transfer-enabled"
                            checked={form.enabled}
                            disabled={loading}
                            onCheckedChange={(enabled) => change((prev) => ({ ...prev, enabled }))}
                        />
                        <Label htmlFor="bank-transfer-enabled" className="cursor-pointer leading-snug">
                            Accept bank transfer &amp; mobile wallets
                        </Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Customers pay into your accounts below. Storvia doesn&apos;t move money: you check that it
                        arrived and mark the order paid.
                    </p>
                    {form.enabled && (
                        <p className="rounded-md bg-muted/50 px-3 py-2 text-sm" aria-live="polite">
                            Customers can pick Bank transfer / JazzCash / Easypaisa at checkout
                        </p>
                    )}
                </div>

                <section aria-labelledby="payment-accounts-heading" className="min-w-0 space-y-3">
                    <h3 id="payment-accounts-heading" className="text-sm font-medium">
                        Accounts ({form.accounts.length} of {MAX_PAYMENT_ACCOUNTS})
                    </h3>

                    {form.accounts.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No accounts yet.</p>
                    ) : (
                        <ol className="min-w-0 space-y-3">
                            {form.accounts.map((account, index) => (
                                <AccountCard
                                    key={account.key}
                                    account={account}
                                    index={index}
                                    count={form.accounts.length}
                                    open={expanded === account.key}
                                    disabled={loading}
                                    error={dirty ? paymentAccountError(toAccountBody(account), index) : null}
                                    onToggle={() =>
                                        setExpanded((current) => (current === account.key ? null : account.key))
                                    }
                                    onChange={(field, value) => updateAccount(account.key, field, value)}
                                    onMove={(delta) => moveAccount(index, delta)}
                                    onRemove={() => removeAccount(account.key)}
                                />
                            ))}
                        </ol>
                    )}

                    <div className="min-w-0 space-y-2">
                        <p className="text-sm font-medium" id="add-payment-account">
                            Add account
                        </p>
                        <div
                            role="group"
                            aria-labelledby="add-payment-account"
                            className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap"
                        >
                            {PAYMENT_ACCOUNT_TYPES.map((type) => (
                                <Button
                                    key={type}
                                    type="button"
                                    variant="outline"
                                    disabled={loading || full}
                                    onClick={() => addAccount(type)}
                                    className="min-h-[44px] w-full justify-start gap-2 sm:w-auto"
                                >
                                    <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
                                    {PAYMENT_ACCOUNT_TYPE_LABELS[type]}
                                </Button>
                            ))}
                        </div>
                        {full && (
                            <p className="text-sm text-muted-foreground">
                                You can add up to {MAX_PAYMENT_ACCOUNTS} accounts.
                            </p>
                        )}
                    </div>
                </section>

                <div className="min-w-0 space-y-2">
                    {dirty && error ? (
                        <p role="alert" className="break-words text-sm font-medium text-destructive">
                            {error}
                        </p>
                    ) : null}
                </div>

                <Button type="submit" disabled={loading || Boolean(error)} className="w-full sm:w-auto">
                    Save payment settings
                </Button>
            </form>
        </div>
    );
}

interface AccountCardProps {
    account: FormAccount;
    index: number;
    count: number;
    open: boolean;
    disabled: boolean;
    /** "Account 2: …" while the form has unsaved edits, else null. */
    error: string | null;
    onToggle: () => void;
    onChange: (field: Field, value: string) => void;
    onMove: (delta: -1 | 1) => void;
    onRemove: () => void;
}

function AccountCard({
    account,
    index,
    count,
    open,
    disabled,
    error,
    onToggle,
    onChange,
    onMove,
    onRemove,
}: AccountCardProps) {
    const name = accountName(account);
    const label = `account ${index + 1}${name ? ` (${name})` : ""}`;
    const fieldsId = `payment-account-${account.key}-fields`;
    const id = (field: Field) => `payment-account-${account.key}-${field}`;
    const bank = account.type === "BANK";
    const iban = normalizeIban(account.iban);

    const text = (field: Field, labelText: string, options: { hint?: string; inputMode?: "numeric" | "tel"; placeholder?: string } = {}) => (
        <div className="min-w-0 space-y-2">
            <Label htmlFor={id(field)}>{labelText}</Label>
            <Input
                id={id(field)}
                value={account[field]}
                disabled={disabled}
                inputMode={options.inputMode}
                placeholder={options.placeholder}
                onChange={(e) => onChange(field, e.target.value)}
                aria-describedby={options.hint ? `${id(field)}-hint` : undefined}
            />
            {options.hint && (
                <p id={`${id(field)}-hint`} className="text-sm text-muted-foreground">
                    {options.hint}
                </p>
            )}
        </div>
    );

    return (
        <li className={`min-w-0 rounded-md border p-3 sm:p-4 ${error ? "border-destructive" : ""}`}>
            <div className="min-w-0 space-y-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <Badge variant="secondary">{PAYMENT_ACCOUNT_TYPE_LABELS[account.type]}</Badge>
                    <span className="min-w-0 break-words font-medium [overflow-wrap:anywhere]">
                        {account.accountTitle.trim() || "Untitled account"}
                    </span>
                </div>
                <p className="break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
                    {bank
                        ? account.bankName.trim() || "Bank name not set"
                        : [
                              account.walletNumber.trim(),
                              account.tillId.trim() && `Till ID ${account.tillId.trim()}`,
                              account.qrImageUrl && "QR code",
                          ]
                              .filter(Boolean)
                              .join(" · ") || PAYMENT_ACCOUNT_TYPE_LABELS[account.type]}
                </p>
                {bank && iban && (
                    <p className="break-all font-mono text-sm">{formatIban(iban)}</p>
                )}
                {error && !open && (
                    <p className="break-words text-sm font-medium text-destructive">{error}</p>
                )}
            </div>

            <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
                <Button
                    type="button"
                    variant="outline"
                    className="min-h-[44px]"
                    aria-expanded={open}
                    aria-controls={fieldsId}
                    aria-label={open ? `Done editing ${label}` : `Edit ${label}`}
                    onClick={onToggle}
                >
                    {open ? "Done" : "Edit"}
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-11 w-11"
                    disabled={disabled || index === 0}
                    aria-label={`Move ${label} up`}
                    onClick={() => onMove(-1)}
                >
                    <ChevronUp className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-11 w-11"
                    disabled={disabled || index === count - 1}
                    aria-label={`Move ${label} down`}
                    onClick={() => onMove(1)}
                >
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 text-destructive"
                    disabled={disabled}
                    aria-label={`Remove ${label}`}
                    onClick={onRemove}
                >
                    <Trash className="h-4 w-4" aria-hidden="true" />
                </Button>
            </div>

            {open && (
                <div id={fieldsId} className="mt-4 min-w-0 space-y-4 border-t pt-4">
                    {error && (
                        <p role="alert" className="break-words text-sm font-medium text-destructive">
                            {error}
                        </p>
                    )}
                    <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
                        {text("accountTitle", "Account title", { hint: "The name on the account." })}
                        {bank ? (
                            <>
                                {text("bankName", "Bank name", { placeholder: "e.g. Meezan Bank" })}
                                {text("iban", "IBAN", {
                                    placeholder: "PK00 XXXX 0000 0000 0000 0000",
                                    hint: "24 characters, starts with PK.",
                                })}
                                {text("accountNumber", "Account number (optional)", { inputMode: "numeric" })}
                                {text("raastId", "Raast ID (optional)", {
                                    inputMode: "tel",
                                    placeholder: "0300 1234567",
                                    hint: "The mobile number linked to Raast.",
                                })}
                            </>
                        ) : (
                            <>
                                {text("walletNumber", "Mobile number (optional)", {
                                    inputMode: "tel",
                                    placeholder: "0300 1234567",
                                })}
                                {text("tillId", "Till ID (optional)")}
                            </>
                        )}
                    </div>
                    {!bank && (
                        <p className="text-sm text-muted-foreground">Add a mobile number, Till ID or QR code.</p>
                    )}
                    <div className="min-w-0 space-y-2">
                        <p className="text-sm font-medium">QR code (optional)</p>
                        <ImageUpload
                            disabled={disabled}
                            value={account.qrImageUrl ? [account.qrImageUrl] : []}
                            onChange={(url) => onChange("qrImageUrl", url)}
                            onRemove={() => onChange("qrImageUrl", "")}
                        />
                    </div>
                    <div className="min-w-0 space-y-2">
                        <Label htmlFor={id("note")}>Note (optional)</Label>
                        <textarea
                            id={id("note")}
                            rows={3}
                            value={account.note}
                            disabled={disabled}
                            onChange={(e) => onChange("note", e.target.value)}
                            className={TEXTAREA_CLASS}
                            aria-describedby={`${id("note")}-hint`}
                        />
                        <p id={`${id("note")}-hint`} className="text-sm text-muted-foreground">
                            Shown to customers with this account, e.g. &quot;Send the payment screenshot on
                            WhatsApp.&quot; At most {MAX_ACCOUNT_NOTE_LENGTH} characters.
                        </p>
                    </div>
                </div>
            )}
        </li>
    );
}
