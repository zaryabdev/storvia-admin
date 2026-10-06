"use client";

import axios from "axios";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Modal } from "@/components/ui/modal";
import { Separator } from "@/components/ui/separator";
import {
    DEFAULT_CONFIRM_TEMPLATE,
    DEFAULT_MESSAGE_TEMPLATE,
    MAX_TEMPLATE_LENGTH,
    SAMPLE_ORDER,
    WHATSAPP_VARIABLES,
    findUnknownPlaceholders,
    renderTemplateSegments,
} from "@/lib/whatsapp-message";

interface WhatsAppTemplatesSectionProps {
    storeId: string;
    storeName: string;
    /** null = the default is in use. */
    initialConfirmTemplate: string | null;
    initialMessageTemplate: string | null;
}

interface TemplateEditorProps {
    id: string;
    title: string;
    help: string;
    value: string;
    defaultValue: string;
    onChange: (value: string) => void;
    onOpenVariables: () => void;
    storeName: string;
    disabled: boolean;
}

function TemplateEditor({
    id,
    title,
    help,
    value,
    defaultValue,
    onChange,
    onOpenVariables,
    storeName,
    disabled,
}: TemplateEditorProps) {
    const tooLong = value.length > MAX_TEMPLATE_LENGTH;
    const unknown = findUnknownPlaceholders(value);
    const segments = renderTemplateSegments(value, { ...SAMPLE_ORDER, storeName }, defaultValue);

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
                rows={title === "Order confirmation" ? 10 : 4}
                onChange={(event) => onChange(event.target.value)}
                className="flex min-h-[80px] w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <p
                className={`text-right text-xs ${tooLong ? "font-medium text-destructive" : "text-muted-foreground"}`}
            >
                {value.length} / {MAX_TEMPLATE_LENGTH}
                {tooLong ? " — too long" : ""}
            </p>

            <div className="min-w-0 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                    Preview (sample order: Ali Raza, 0300 1234567, Lahore, 3 items, Rs 4,500)
                </p>
                <div className="min-w-0 whitespace-pre-wrap break-words rounded-md bg-muted/50 p-3 text-sm [overflow-wrap:anywhere]">
                    {segments.map((segment, index) =>
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
                    )}
                </div>
                {unknown.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                        Unknown variable{unknown.length > 1 ? "s" : ""} {unknown.join(", ")}: it will be sent as
                        typed.
                    </p>
                )}
            </div>
        </div>
    );
}

export function WhatsAppTemplatesSection({
    storeId,
    storeName,
    initialConfirmTemplate,
    initialMessageTemplate,
}: WhatsAppTemplatesSectionProps) {
    const router = useRouter();
    const [confirm, setConfirm] = useState(initialConfirmTemplate ?? DEFAULT_CONFIRM_TEMPLATE);
    const [message, setMessage] = useState(initialMessageTemplate ?? DEFAULT_MESSAGE_TEMPLATE);
    const [variablesOpen, setVariablesOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const tooLong = confirm.length > MAX_TEMPLATE_LENGTH || message.length > MAX_TEMPLATE_LENGTH;

    const save = async () => {
        try {
            setLoading(true);
            const { data } = await axios.patch<{
                confirmTemplate: string | null;
                messageTemplate: string | null;
            }>(`/api/stores/${storeId}/whatsapp-templates`, {
                confirmTemplate: confirm,
                messageTemplate: message,
            });
            setConfirm(data.confirmTemplate ?? DEFAULT_CONFIRM_TEMPLATE);
            setMessage(data.messageTemplate ?? DEFAULT_MESSAGE_TEMPLATE);
            router.refresh();
            toast.success("WhatsApp messages saved.");
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
        <div className="min-w-0 space-y-4">
            <Modal
                title="Variables"
                description="Type a variable in curly brackets, for example {customer_name}. It's replaced with the order's details when you open WhatsApp."
                isOpen={variablesOpen}
                onClose={() => setVariablesOpen(false)}
            >
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
                            {WHATSAPP_VARIABLES.map((variable) => (
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
            <Heading
                title="WhatsApp messages"
                description="The messages the Orders page opens in WhatsApp. Nothing is sent automatically."
            />
            <Separator />
            <TemplateEditor
                id="whatsapp-confirm-template"
                title="Order confirmation"
                help="Used by “Confirm on WhatsApp” on new (pending) orders."
                value={confirm}
                defaultValue={DEFAULT_CONFIRM_TEMPLATE}
                onChange={setConfirm}
                onOpenVariables={() => setVariablesOpen(true)}
                storeName={storeName}
                disabled={loading}
            />
            <TemplateEditor
                id="whatsapp-message-template"
                title="General message"
                help="Used by “Message on WhatsApp” on every other order."
                value={message}
                defaultValue={DEFAULT_MESSAGE_TEMPLATE}
                onChange={setMessage}
                onOpenVariables={() => setVariablesOpen(true)}
                storeName={storeName}
                disabled={loading}
            />
            <Button
                type="button"
                disabled={loading || tooLong}
                className="w-full sm:w-auto"
                onClick={save}
            >
                Save WhatsApp messages
            </Button>
        </div>
    );
}
