"use client";

import axios from "axios";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import type { OrderTemplateData } from "@/lib/order-template";
import {
    DEFAULT_SLIP_FOOTER_TEMPLATE,
    DEFAULT_SLIP_HEADER_TEMPLATE,
    MAX_SLIP_TEMPLATE_LENGTH,
    SLIP_PAPER_SIZES,
    isSlipPaperSize,
    type SlipPaperSizeValue,
} from "@/lib/packing-slip";

import { TemplateEditor, VariablesModal } from "./template-editor";

interface PackingSlipSectionProps {
    storeId: string;
    /** Sample order for the previews (this Store's name and sender details). */
    sample: OrderTemplateData;
    initialPaperSize: string;
    /** null = the default is in use. */
    initialHeaderTemplate: string | null;
    initialFooterTemplate: string | null;
}

const PAPER_LABELS: Record<SlipPaperSizeValue, string> = {
    A5: "A5 (148 × 210 mm)",
    A4: "A4 (210 × 297 mm)",
};

export function PackingSlipSection({
    storeId,
    sample,
    initialPaperSize,
    initialHeaderTemplate,
    initialFooterTemplate,
}: PackingSlipSectionProps) {
    const router = useRouter();
    const [paperSize, setPaperSize] = useState<SlipPaperSizeValue>(
        isSlipPaperSize(initialPaperSize) ? initialPaperSize : "A5",
    );
    const [header, setHeader] = useState(initialHeaderTemplate ?? DEFAULT_SLIP_HEADER_TEMPLATE);
    const [footer, setFooter] = useState(initialFooterTemplate ?? DEFAULT_SLIP_FOOTER_TEMPLATE);
    const [variablesOpen, setVariablesOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const tooLong = header.length > MAX_SLIP_TEMPLATE_LENGTH || footer.length > MAX_SLIP_TEMPLATE_LENGTH;

    const save = async () => {
        try {
            setLoading(true);
            const { data } = await axios.patch<{
                paperSize: string;
                headerTemplate: string | null;
                footerTemplate: string | null;
            }>(`/api/stores/${storeId}/packing-slip-settings`, {
                paperSize,
                headerTemplate: header,
                footerTemplate: footer,
            });
            if (isSlipPaperSize(data.paperSize)) setPaperSize(data.paperSize);
            setHeader(data.headerTemplate ?? DEFAULT_SLIP_HEADER_TEMPLATE);
            setFooter(data.footerTemplate ?? DEFAULT_SLIP_FOOTER_TEMPLATE);
            router.refresh();
            toast.success("Packing slip settings saved.");
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
            <VariablesModal
                description="Type a variable in curly brackets, for example {customer_name}. It's replaced with the order's details when the slip is printed."
                isOpen={variablesOpen}
                onClose={() => setVariablesOpen(false)}
            />
            <Heading
                title="Packing slips"
                description="The slip you print from the Orders page. Prices can be shown or hidden each time you print."
            />
            <Separator />
            <div className="min-w-0 space-y-2 rounded-md border p-4">
                <label htmlFor="slip-paper-size" className="text-sm font-medium">
                    Paper size
                </label>
                <p className="text-sm text-muted-foreground">
                    The slip is laid out for this paper. Pick the same size in your printer&apos;s dialog.
                </p>
                <select
                    id="slip-paper-size"
                    value={paperSize}
                    disabled={loading}
                    onChange={(event) => {
                        if (isSlipPaperSize(event.target.value)) setPaperSize(event.target.value);
                    }}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-64"
                >
                    {SLIP_PAPER_SIZES.map((size) => (
                        <option key={size} value={size}>
                            {PAPER_LABELS[size]}
                        </option>
                    ))}
                </select>
            </div>
            <TemplateEditor
                id="slip-header-template"
                title="Header note"
                help="Printed near the top of the slip. Leave empty to print nothing."
                value={header}
                defaultValue={DEFAULT_SLIP_HEADER_TEMPLATE}
                max={MAX_SLIP_TEMPLATE_LENGTH}
                rows={3}
                onChange={setHeader}
                onOpenVariables={() => setVariablesOpen(true)}
                sample={sample}
                unknownVerb="printed"
                emptyPreview="Nothing printed (empty)."
                disabled={loading}
            />
            <TemplateEditor
                id="slip-footer-template"
                title="Footer message"
                help="Printed at the bottom of the slip."
                value={footer}
                defaultValue={DEFAULT_SLIP_FOOTER_TEMPLATE}
                max={MAX_SLIP_TEMPLATE_LENGTH}
                rows={4}
                onChange={setFooter}
                onOpenVariables={() => setVariablesOpen(true)}
                sample={sample}
                unknownVerb="printed"
                emptyPreview="Nothing printed (empty)."
                disabled={loading}
            />
            <Button
                type="button"
                disabled={loading || tooLong}
                className="w-full sm:w-auto"
                onClick={save}
            >
                Save packing slip settings
            </Button>
        </div>
    );
}
