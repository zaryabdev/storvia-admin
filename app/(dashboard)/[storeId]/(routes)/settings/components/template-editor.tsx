"use client";

import { toast } from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import {
    ORDER_TEMPLATE_VARIABLES,
    findUnknownPlaceholders,
    renderTemplateSegments,
    type OrderTemplateData,
} from "@/lib/order-template";

// Shared by the WhatsApp messages and Packing slips sections: one template's
// textarea, counter, Variables / Reset buttons and live preview.

interface TemplateEditorProps {
    id: string;
    title: string;
    help: string;
    value: string;
    defaultValue: string;
    max: number;
    rows: number;
    onChange: (value: string) => void;
    onOpenVariables: () => void;
    sample: OrderTemplateData;
    /** How unknown variables end up: "sent" (WhatsApp) or "printed" (slips). */
    unknownVerb: string;
    /** Shown in the preview when the rendered text is empty. */
    emptyPreview?: string;
    disabled: boolean;
}

export function TemplateEditor({
    id,
    title,
    help,
    value,
    defaultValue,
    max,
    rows,
    onChange,
    onOpenVariables,
    sample,
    unknownVerb,
    emptyPreview,
    disabled,
}: TemplateEditorProps) {
    const tooLong = value.length > max;
    const unknown = findUnknownPlaceholders(value);
    const segments = renderTemplateSegments(value, sample, defaultValue);
    const isEmpty = segments.every((segment) => !segment.text.trim());

    return (
        <div className="min-w-0 space-y-3 rounded-md border p-4">
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <label htmlFor={id} className="text-sm font-medium">
                        {title}
                    </label>
                    <p className="text-sm text-muted-foreground">{help}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" className="min-h-[40px]" onClick={onOpenVariables}>
                        Variables
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-[40px]"
                        disabled={disabled || value === defaultValue}
                        onClick={() => onChange(defaultValue)}
                    >
                        Reset to default
                    </Button>
                </div>
            </div>

            <textarea
                id={id}
                value={value}
                disabled={disabled}
                rows={rows}
                onChange={(event) => onChange(event.target.value)}
                className="flex min-h-[80px] w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <p
                className={`text-right text-xs ${tooLong ? "font-medium text-destructive" : "text-muted-foreground"}`}
            >
                {value.length} / {max}
                {tooLong ? " — too long" : ""}
            </p>

            <div className="min-w-0 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                    Preview (sample order: Ali Raza, 0300 1234567, Lahore, 3 items, Rs 4,500)
                </p>
                <div className="min-w-0 whitespace-pre-wrap break-words rounded-md bg-muted/50 p-3 text-sm [overflow-wrap:anywhere]">
                    {isEmpty && emptyPreview ? (
                        <span className="text-muted-foreground">{emptyPreview}</span>
                    ) : (
                        segments.map((segment, index) =>
                            segment.unknown ? (
                                <mark
                                    key={index}
                                    className="rounded bg-yellow-200 px-0.5 text-foreground"
                                >
                                    {segment.text}
                                </mark>
                            ) : (
                                <span key={index}>{segment.text}</span>
                            ),
                        )
                    )}
                </div>
                {unknown.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                        Unknown variable{unknown.length > 1 ? "s" : ""} {unknown.join(", ")}: it will be {unknownVerb} as
                        typed.
                    </p>
                )}
            </div>
        </div>
    );
}

interface VariablesModalProps {
    isOpen: boolean;
    onClose: () => void;
    description: string;
}

// Every order-template variable (including the sender ones) with Copy buttons.
export function VariablesModal({ isOpen, onClose, description }: VariablesModalProps) {
    const copy = async (key: string) => {
        const token = `{${key}}`;

        try {
            await navigator.clipboard.writeText(token);
            toast.success(`Copied ${token}`);
        } catch {
            toast.error("Couldn't copy. Select the variable and copy it by hand.");
        }
    };

    return (
        <Modal title="Variables" description={description} isOpen={isOpen} onClose={onClose}>
            <div className="max-h-[55vh] overflow-y-auto pr-1">
                <table className="w-full text-left text-sm">
                    <thead className="hidden sm:table-header-group">
                        <tr className="border-b">
                            <th className="py-2 pr-3 font-medium">Variable</th>
                            <th className="py-2 pr-3 font-medium">Meaning</th>
                            <th className="py-2 font-medium">Example</th>
                        </tr>
                    </thead>
                    <tbody>
                        {ORDER_TEMPLATE_VARIABLES.map((variable) => (
                            <tr key={variable.key} className="block border-b py-2 sm:table-row">
                                <td className="block py-1 pr-3 align-top sm:table-cell">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                                            {`{${variable.key}}`}
                                        </code>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-8"
                                            aria-label={`Copy {${variable.key}}`}
                                            onClick={() => copy(variable.key)}
                                        >
                                            Copy
                                        </Button>
                                    </div>
                                </td>
                                <td className="block py-1 pr-3 align-top text-muted-foreground sm:table-cell">
                                    {variable.description}
                                </td>
                                <td className="block whitespace-pre-line break-words py-1 align-top [overflow-wrap:anywhere] sm:table-cell">
                                    <span className="text-xs text-muted-foreground sm:hidden">e.g. </span>
                                    {variable.example}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Modal>
    );
}
