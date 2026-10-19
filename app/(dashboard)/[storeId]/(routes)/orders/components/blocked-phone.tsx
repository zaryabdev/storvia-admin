"use client";

import axios from "axios";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-hot-toast";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_BLOCKED_NOTE_LENGTH, blockedPhoneKey, parseBlockedPhoneInput } from "@/lib/blocked-phones";
import { cn } from "@/lib/utils";

import { ConfirmDialog } from "./confirm-dialog";

// Phone blocklist UI shared by Orders and Customers. Rules: DECISIONS.md →
// Phone blocklist. Requests go by blocked-row id; a phone is never in a URL.

// The server's message: plain text (400) or { message } (404), else a generic one.
export function blockedPhoneErrorText(error: unknown): string {
    const data = axios.isAxiosError(error) ? error.response?.data : undefined;
    if (typeof data === "string" && data && data !== "Internal error") return data;
    if (data && typeof data.message === "string" && data.message) return data.message;
    return "Something went wrong.";
}

// "Blocked" next to the customer history line; amber, never red. The word
// carries the meaning.
export function BlockedBadge({ blocked, className }: { blocked: boolean; className?: string }) {
    if (!blocked) return null;

    return (
        <Badge
            className={cn(
                "whitespace-nowrap rounded-md border-amber-300 bg-amber-50 px-2 py-0.5 font-medium text-amber-900 hover:bg-amber-50",
                className,
            )}
        >
            Blocked<span className="sr-only"> number: new website orders are refused</span>
        </Badge>
    );
}

// "Unblock" → confirm → DELETE → "Number unblocked.".
export function UnblockPhoneButton({
    blockedPhoneId,
    phone,
    className,
}: {
    blockedPhoneId: string;
    phone: string;
    className?: string;
}) {
    const params = useParams();
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const unblock = async () => {
        try {
            setLoading(true);
            await axios.delete(`/api/stores/${params.storeId}/blocked-phones/${blockedPhoneId}`);
            toast.success("Number unblocked.");
            setOpen(false);
            router.refresh();
        } catch (error) {
            toast.error(blockedPhoneErrorText(error));
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn("min-h-[44px] w-full sm:w-auto", className)}
                aria-label={`Unblock ${phone}`}
                onClick={() => setOpen(true)}
            >
                Unblock
            </Button>
            <ConfirmDialog
                open={open}
                title={`Unblock ${phone}?`}
                description="New orders from this number will be accepted on your website again."
                confirmLabel="Unblock"
                loading={loading}
                onClose={() => !loading && setOpen(false)}
                onConfirm={unblock}
            />
        </>
    );
}

// "Block number" (with an optional reason) or, once blocked, "Unblock".
// Nothing for a phone that isn't a Pakistani mobile (it can't be blocked).
export function BlockPhoneAction({ phone, blockedPhoneId }: { phone: string; blockedPhoneId: string | null }) {
    const params = useParams();
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [note, setNote] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    if (!blockedPhoneKey(phone)) return null;
    if (blockedPhoneId) return <UnblockPhoneButton blockedPhoneId={blockedPhoneId} phone={phone} />;

    const close = () => {
        if (loading) return;
        setOpen(false);
        setNote("");
        setError(null);
    };

    const block = async () => {
        const parsed = parseBlockedPhoneInput({ phone, note });
        if ("error" in parsed) {
            setError(parsed.error);
            return;
        }

        try {
            setLoading(true);
            await axios.post(`/api/stores/${params.storeId}/blocked-phones`, { phone, note });
            toast.success("Number blocked.");
            setOpen(false);
            setNote("");
            setError(null);
            router.refresh();
        } catch (requestError) {
            setError(blockedPhoneErrorText(requestError));
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-[44px] w-full sm:w-auto"
                onClick={() => setOpen(true)}
            >
                Block number
            </Button>
            <ConfirmDialog
                open={open}
                title={`Block ${phone}?`}
                description="New orders from this number will be refused on your website. Existing orders aren't changed."
                confirmLabel="Block"
                loading={loading}
                onClose={close}
                onConfirm={block}
            >
                <div className="min-w-0 space-y-2">
                    <Label htmlFor="block-phone-note">Reason (optional)</Label>
                    <Input
                        id="block-phone-note"
                        value={note}
                        disabled={loading}
                        maxLength={MAX_BLOCKED_NOTE_LENGTH * 2}
                        autoComplete="off"
                        onChange={(event) => {
                            setNote(event.target.value);
                            setError(null);
                        }}
                        aria-invalid={Boolean(error)}
                        aria-describedby={error ? "block-phone-error" : undefined}
                        className="h-11"
                    />
                    {error && (
                        <p id="block-phone-error" role="alert" className="text-sm font-medium text-destructive">
                            {error}
                        </p>
                    )}
                </div>
            </ConfirmDialog>
        </>
    );
}
