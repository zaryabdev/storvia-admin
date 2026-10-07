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
    DEFAULT_CONFIRM_TEMPLATE,
    DEFAULT_MESSAGE_TEMPLATE,
    MAX_TEMPLATE_LENGTH,
} from "@/lib/whatsapp-message";

import { TemplateEditor, VariablesModal } from "./template-editor";

interface WhatsAppTemplatesSectionProps {
    storeId: string;
    /** Sample order for the previews (this Store's name and sender details). */
    sample: OrderTemplateData;
    /** null = the default is in use. */
    initialConfirmTemplate: string | null;
    initialMessageTemplate: string | null;
}

export function WhatsAppTemplatesSection({
    storeId,
    sample,
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

    return (
        <div className="min-w-0 space-y-4">
            <VariablesModal
                description="Type a variable in curly brackets, for example {customer_name}. It's replaced with the order's details when you open WhatsApp."
                isOpen={variablesOpen}
                onClose={() => setVariablesOpen(false)}
            />
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
                max={MAX_TEMPLATE_LENGTH}
                rows={10}
                onChange={setConfirm}
                onOpenVariables={() => setVariablesOpen(true)}
                sample={sample}
                unknownVerb="sent"
                disabled={loading}
            />
            <TemplateEditor
                id="whatsapp-message-template"
                title="General message"
                help="Used by “Message on WhatsApp” on every other order."
                value={message}
                defaultValue={DEFAULT_MESSAGE_TEMPLATE}
                max={MAX_TEMPLATE_LENGTH}
                rows={4}
                onChange={setMessage}
                onOpenVariables={() => setVariablesOpen(true)}
                sample={sample}
                unknownVerb="sent"
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
