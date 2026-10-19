"use client";

import axios from "axios";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { MAX_BLOCKED_NOTE_LENGTH, parseBlockedPhoneInput } from "@/lib/blocked-phones";

import { UnblockPhoneButton, blockedPhoneErrorText } from "../../orders/components/blocked-phone";

export type BlockedNumberRow = {
    id: string;
    /** As the merchant entered it. */
    phone: string;
    note: string | null;
    /** "6 Oct 2026", Pakistan time. */
    date: string;
};

// The Store's blocklist (newest first): add a number with an optional reason,
// unblock one. Phones go in request bodies only, never in a URL. Rules:
// DECISIONS.md → Phone blocklist.
export function BlockedNumbersModal({
    open,
    onClose,
    items,
}: {
    open: boolean;
    onClose: () => void;
    items: BlockedNumberRow[];
}) {
    const params = useParams();
    const router = useRouter();
    const [phone, setPhone] = useState("");
    const [note, setNote] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const add = async () => {
        const parsed = parseBlockedPhoneInput({ phone, note });
        if ("error" in parsed) {
            setError(parsed.error);
            return;
        }

        try {
            setLoading(true);
            await axios.post(`/api/stores/${params.storeId}/blocked-phones`, { phone, note });
            toast.success("Number blocked.");
            setPhone("");
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
        <Modal
            isOpen={open}
            onClose={() => !loading && onClose()}
            title="Blocked numbers"
            description="New orders from these numbers are refused on your website. Existing orders and orders you create aren't affected."
        >
            <div className="min-w-0 space-y-5">
                <form
                    noValidate
                    className="min-w-0 space-y-3 rounded-xl border p-3"
                    onSubmit={(event) => {
                        event.preventDefault();
                        add();
                    }}
                >
                    <div className="min-w-0 space-y-2">
                        <Label htmlFor="blocked-number-phone">Phone</Label>
                        <Input
                            id="blocked-number-phone"
                            type="tel"
                            inputMode="tel"
                            autoComplete="off"
                            placeholder="0300 1234567"
                            value={phone}
                            disabled={loading}
                            onChange={(event) => {
                                setPhone(event.target.value);
                                setError(null);
                            }}
                            aria-invalid={Boolean(error)}
                            aria-describedby={error ? "blocked-number-error" : undefined}
                            className="h-11"
                        />
                    </div>
                    <div className="min-w-0 space-y-2">
                        <Label htmlFor="blocked-number-note">Reason (optional)</Label>
                        <Input
                            id="blocked-number-note"
                            autoComplete="off"
                            value={note}
                            maxLength={MAX_BLOCKED_NOTE_LENGTH * 2}
                            disabled={loading}
                            onChange={(event) => {
                                setNote(event.target.value);
                                setError(null);
                            }}
                            className="h-11"
                        />
                    </div>
                    {error && (
                        <p id="blocked-number-error" role="alert" className="text-sm font-medium text-destructive">
                            {error}
                        </p>
                    )}
                    <Button type="submit" disabled={loading} className="min-h-[44px] w-full sm:w-auto">
                        Add number
                    </Button>
                </form>

                {items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No blocked numbers.</p>
                ) : (
                    <ul className="min-w-0 space-y-2">
                        {items.map((item) => (
                            <li
                                key={item.id}
                                className="flex min-w-0 flex-col gap-3 rounded-xl border p-3 text-sm sm:flex-row sm:items-start sm:justify-between"
                            >
                                <div className="min-w-0">
                                    <p className="break-words font-medium [overflow-wrap:anywhere]">{item.phone}</p>
                                    {item.note ? (
                                        <p className="break-words text-muted-foreground [overflow-wrap:anywhere]" dir="auto">
                                            {item.note}
                                        </p>
                                    ) : null}
                                    <p className="text-xs text-muted-foreground">Blocked {item.date}</p>
                                </div>
                                <UnblockPhoneButton blockedPhoneId={item.id} phone={item.phone} className="shrink-0" />
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </Modal>
    );
}
