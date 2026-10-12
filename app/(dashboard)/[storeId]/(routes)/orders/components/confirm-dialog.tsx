"use client";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

interface ConfirmDialogProps {
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    cancelLabel?: string;
    destructive?: boolean;
    loading?: boolean;
    /** Disables the confirm button (e.g. nothing chosen yet). */
    confirmDisabled?: boolean;
    onConfirm: () => void;
    onClose: () => void;
    children?: React.ReactNode;
}

// A yes/no dialog for order actions (payment, status warnings). Buttons stack
// full width on phones, 44 px tall.
export function ConfirmDialog({
    open,
    title,
    description,
    confirmLabel,
    cancelLabel = "Cancel",
    destructive,
    loading,
    confirmDisabled,
    onConfirm,
    onClose,
    children,
}: ConfirmDialogProps) {
    return (
        <Modal title={title} description={description} isOpen={open} onClose={onClose}>
            {children}
            <div className="flex flex-col-reverse gap-2 pt-6 sm:flex-row sm:justify-end">
                <Button
                    type="button"
                    variant="outline"
                    disabled={loading}
                    onClick={onClose}
                    className="min-h-[44px] w-full sm:w-auto"
                >
                    {cancelLabel}
                </Button>
                <Button
                    type="button"
                    variant={destructive ? "destructive" : "default"}
                    disabled={loading || confirmDisabled}
                    onClick={onConfirm}
                    className="min-h-[44px] w-full sm:w-auto"
                >
                    {confirmLabel}
                </Button>
            </div>
        </Modal>
    );
}
