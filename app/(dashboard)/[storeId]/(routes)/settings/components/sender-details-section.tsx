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
    SENDER_FIELDS,
    SenderDetails,
    isSenderDetailsComplete,
    senderFieldError,
} from "@/lib/sender-details";

type SavedDetails = { [K in keyof SenderDetails]: string | null };

interface SenderDetailsSectionProps {
    storeId: string;
    initialDetails: SavedDetails;
}

const INPUTS: Record<
    keyof SenderDetails,
    { placeholder: string; autoComplete: string; type?: string; inputMode?: "tel" }
> = {
    senderName: { placeholder: "Your store or business name", autoComplete: "organization" },
    senderPhone: { placeholder: "0300 1234567", autoComplete: "tel", type: "tel", inputMode: "tel" },
    senderAddress: { placeholder: "Shop, street, area", autoComplete: "street-address" },
    senderCity: { placeholder: "Lahore", autoComplete: "address-level2" },
};

export function SenderDetailsSection({ storeId, initialDetails }: SenderDetailsSectionProps) {
    const router = useRouter();
    const [saved, setSaved] = useState<SavedDetails>(initialDetails);
    const [values, setValues] = useState<SenderDetails>({
        senderName: initialDetails.senderName ?? "",
        senderPhone: initialDetails.senderPhone ?? "",
        senderAddress: initialDetails.senderAddress ?? "",
        senderCity: initialDetails.senderCity ?? "",
    });
    const [touched, setTouched] = useState<Partial<Record<keyof SenderDetails, boolean>>>({});
    const [loading, setLoading] = useState(false);

    const errors = Object.fromEntries(
        SENDER_FIELDS.map(({ key }) => [key, senderFieldError(key, values[key])]),
    ) as Record<keyof SenderDetails, string | null>;
    const isValid = SENDER_FIELDS.every(({ key }) => !errors[key]);

    const save = async () => {
        if (!isValid) {
            setTouched({ senderName: true, senderPhone: true, senderAddress: true, senderCity: true });
            return;
        }

        try {
            setLoading(true);
            const { data } = await axios.patch<SavedDetails>(
                `/api/stores/${storeId}/sender-details`,
                values,
            );
            setSaved(data);
            setValues({
                senderName: data.senderName ?? "",
                senderPhone: data.senderPhone ?? "",
                senderAddress: data.senderAddress ?? "",
                senderCity: data.senderCity ?? "",
            });
            router.refresh();
            toast.success("Sender details saved.");
        } catch (error: any) {
            const text = error?.response?.data;
            toast.error(
                error?.response?.status === 400 && typeof text === "string" && text
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
                title="Sender details"
                description="Printed on packing slips as the return address. All fields are required."
            />
            <Separator />
            {!isSenderDetailsComplete(saved) && (
                <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    Packing slips can&apos;t be printed until sender details are complete.
                </p>
            )}
            <form
                noValidate
                className="space-y-6"
                onSubmit={(e) => {
                    e.preventDefault();
                    save();
                }}
            >
                <div className="grid min-w-0 grid-cols-1 gap-6 md:grid-cols-2">
                    {SENDER_FIELDS.map(({ key, label }) => {
                        const id = `sender-${key}`;
                        const showError = Boolean(touched[key] && errors[key]);
                        const input = INPUTS[key];

                        return (
                            <div key={key} className="min-w-0 space-y-2">
                                <Label htmlFor={id}>{label}</Label>
                                <Input
                                    id={id}
                                    type={input.type ?? "text"}
                                    inputMode={input.inputMode}
                                    autoComplete={input.autoComplete}
                                    placeholder={input.placeholder}
                                    disabled={loading}
                                    value={values[key]}
                                    onChange={(e) =>
                                        setValues((prev) => ({ ...prev, [key]: e.target.value }))
                                    }
                                    onBlur={() => setTouched((prev) => ({ ...prev, [key]: true }))}
                                    aria-invalid={showError}
                                    aria-describedby={showError ? `${id}-error` : undefined}
                                />
                                {showError && (
                                    <p id={`${id}-error`} className="text-sm font-medium text-destructive">
                                        {errors[key]}
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>
                <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                    Save sender details
                </Button>
            </form>
        </div>
    );
}
