"use client";

import axios from "axios";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { BarChart3, Megaphone, MessageCircle, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Heading } from "@/components/ui/heading";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Separator } from "@/components/ui/separator";
import {
    INTEGRATION_PROVIDERS,
    type IntegrationProvider,
    type IntegrationProviderKey,
    type IntegrationsBody,
    type IntegrationState,
    isConnected,
    maskPixelId,
} from "@/lib/integrations";
import { cn } from "@/lib/utils";

// Per-provider copy. Plain text only: no external links in the dashboard.
const COPY: Record<
    IntegrationProviderKey,
    { description: string; steps: string[]; check: string; company: string; icon: typeof Megaphone }
> = {
    meta: {
        description: "Track visits, add-to-carts and orders from your Facebook & Instagram ads.",
        steps: [
            "Open Meta Events Manager (business.facebook.com/events_manager).",
            "Under Data sources, select your pixel (dataset).",
            "Copy the ID shown under its name.",
        ],
        check: "Install the free Meta Pixel Helper extension for Chrome, then open your store.",
        company: "Meta",
        icon: Megaphone,
    },
    tiktok: {
        description: "Track visits, add-to-carts and orders from your TikTok ads.",
        steps: [
            "Open TikTok Ads Manager.",
            "Go to Tools → Events → Web Events.",
            "Select your pixel and copy the ID shown under its name.",
        ],
        check: "Install the free TikTok Pixel Helper extension for Chrome, then open your store.",
        company: "TikTok",
        icon: BarChart3,
    },
};

const COMING_SOON = [
    {
        name: "Google Ads",
        description: "Track sales from your Google Search and YouTube ads.",
        icon: Search,
    },
    {
        name: "WhatsApp Business API",
        description: "Send automatic order messages and track WhatsApp ads.",
        icon: MessageCircle,
    },
];

const apiErrorText = (error: any) => {
    const text = error?.response?.data;
    return error?.response?.status === 400 && typeof text === "string" && text
        ? text
        : "Something went wrong.";
};

interface IntegrationsSectionProps {
    storeId: string;
    initialIntegrations: IntegrationsBody;
}

export function IntegrationsSection({ storeId, initialIntegrations }: IntegrationsSectionProps) {
    const router = useRouter();
    const [integrations, setIntegrations] = useState<IntegrationsBody>(initialIntegrations);

    const patch = async (body: {
        provider: IntegrationProviderKey;
        pixelId?: string | null;
        enabled?: boolean;
    }) => {
        const { data } = await axios.patch<IntegrationsBody>(
            `/api/stores/${storeId}/integrations`,
            body,
        );
        setIntegrations(data);
        router.refresh();
        return data;
    };

    return (
        <div className="min-w-0 space-y-4">
            <Heading
                title="Integrations"
                description="Connect your ad accounts to measure sales from your ads."
            />
            <Separator />

            <section aria-labelledby="integrations-ad-tracking" className="space-y-3">
                <h3 id="integrations-ad-tracking" className="text-lg font-semibold">
                    Ad tracking
                </h3>
                <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
                    {INTEGRATION_PROVIDERS.map((provider) => (
                        <PixelCard
                            key={provider.key}
                            provider={provider}
                            state={integrations[provider.key]}
                            onLocalChange={(state) =>
                                setIntegrations((prev) => ({ ...prev, [provider.key]: state }))
                            }
                            patch={patch}
                        />
                    ))}
                </div>
            </section>

            <section aria-labelledby="integrations-coming-soon" className="space-y-3 pt-4">
                <h3 id="integrations-coming-soon" className="text-lg font-semibold">
                    Coming soon
                </h3>
                <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
                    {COMING_SOON.map(({ name, description, icon: Icon }) => (
                        <Card key={name} className="min-w-0 bg-muted/40 text-muted-foreground">
                            <CardHeader className="flex min-w-0 flex-row items-start gap-3 space-y-0">
                                <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                                <div className="min-w-0 flex-1 space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <CardTitle className="break-words text-base">{name}</CardTitle>
                                        <Badge variant="outline" className="text-muted-foreground">
                                            Coming soon
                                        </Badge>
                                    </div>
                                    <CardDescription className="break-words">{description}</CardDescription>
                                </div>
                            </CardHeader>
                        </Card>
                    ))}
                </div>
            </section>
        </div>
    );
}

type Patch = (body: {
    provider: IntegrationProviderKey;
    pixelId?: string | null;
    enabled?: boolean;
}) => Promise<IntegrationsBody>;

interface PixelCardProps {
    provider: IntegrationProvider;
    state: IntegrationState;
    onLocalChange: (state: IntegrationState) => void;
    patch: Patch;
}

function PixelCard({ provider, state, onLocalChange, patch }: PixelCardProps) {
    const copy = COPY[provider.key];
    const Icon = copy.icon;
    const connected = isConnected(state);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [toggling, setToggling] = useState(false);
    const actionRef = useRef<HTMLButtonElement>(null);

    const toggle = async () => {
        const previous = state;
        const enabled = !state.enabled;
        onLocalChange({ ...state, enabled });

        try {
            setToggling(true);
            await patch({ provider: provider.key, enabled });
            toast.success(`${provider.name} ${enabled ? "resumed" : "paused"}`);
        } catch (error: any) {
            onLocalChange(previous);
            toast.error(apiErrorText(error));
        } finally {
            setToggling(false);
        }
    };

    const switchId = `integration-${provider.key}-switch`;

    return (
        <Card className="min-w-0">
            <CardHeader className="flex min-w-0 flex-row items-start gap-3 space-y-0">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="break-words text-base">{provider.name}</CardTitle>
                        {connected &&
                            (state.enabled ? (
                                <Badge className="border-transparent bg-green-600 text-white hover:bg-green-600/80">
                                    Active
                                </Badge>
                            ) : (
                                <Badge variant="secondary">Paused</Badge>
                            ))}
                    </div>
                    <CardDescription className="break-words">{copy.description}</CardDescription>
                </div>
            </CardHeader>
            <CardContent className="min-w-0 space-y-4">
                {connected && state.pixelId && (
                    <div className="space-y-3">
                        <p className="text-sm">
                            <span className="text-muted-foreground">{provider.fieldLabel}: </span>
                            <span className="font-mono">{maskPixelId(state.pixelId)}</span>
                        </p>
                        <div className="flex min-h-[44px] items-center gap-3">
                            <button
                                id={switchId}
                                type="button"
                                role="switch"
                                aria-checked={state.enabled}
                                aria-label={`${provider.name} tracking`}
                                disabled={toggling}
                                onClick={toggle}
                                className="group inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <span
                                    aria-hidden="true"
                                    className={cn(
                                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                                        state.enabled ? "bg-primary" : "bg-input",
                                    )}
                                >
                                    <span
                                        className={cn(
                                            "inline-block h-5 w-5 rounded-full bg-background shadow transition-transform",
                                            state.enabled ? "translate-x-5" : "translate-x-0.5",
                                        )}
                                    />
                                </span>
                            </button>
                            <span className="text-sm" aria-hidden="true">
                                Tracking on
                            </span>
                        </div>
                        {!state.enabled && (
                            <p className="text-sm text-muted-foreground">
                                Tracking is paused. Your ID is kept.
                            </p>
                        )}
                    </div>
                )}
                <Button
                    ref={actionRef}
                    variant={connected ? "outline" : "default"}
                    className="min-h-[44px] w-full sm:w-auto"
                    onClick={() => setDialogOpen(true)}
                >
                    {connected ? "Manage" : "Integrate"}
                </Button>
                <PixelDialog
                    provider={provider}
                    state={state}
                    open={dialogOpen}
                    onClose={() => setDialogOpen(false)}
                    returnFocusTo={actionRef}
                    patch={patch}
                />
            </CardContent>
        </Card>
    );
}

interface PixelDialogProps {
    provider: IntegrationProvider;
    state: IntegrationState;
    open: boolean;
    onClose: () => void;
    returnFocusTo: React.RefObject<HTMLButtonElement>;
    patch: Patch;
}

function PixelDialog({ provider, state, open, onClose, returnFocusTo, patch }: PixelDialogProps) {
    const copy = COPY[provider.key];
    const connected = isConnected(state);
    const [value, setValue] = useState("");
    const [touched, setTouched] = useState(false);
    const [saving, setSaving] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);

    const error = provider.validate(value);
    const showError = touched && Boolean(error);
    const inputId = `integration-${provider.key}-id`;

    const onOpenChange = (next: boolean) => {
        if (next) return;
        if (saving) return;
        setConfirmOpen(false);
        onClose();
    };

    // Reset the field each time the dialog opens.
    const [wasOpen, setWasOpen] = useState(open);
    if (open !== wasOpen) {
        setWasOpen(open);
        if (open) {
            setValue(state.pixelId ?? "");
            setTouched(false);
        }
    }

    const save = async () => {
        if (error) {
            setTouched(true);
            return;
        }

        try {
            setSaving(true);
            await patch({ provider: provider.key, pixelId: value });
            toast.success(`${provider.name} ${connected ? "ID updated" : "connected"}`);
            onClose();
        } catch (err: any) {
            toast.error(apiErrorText(err));
        } finally {
            setSaving(false);
        }
    };

    const disconnect = async () => {
        try {
            setSaving(true);
            await patch({ provider: provider.key, pixelId: null });
            toast.success(`${provider.name} disconnected`);
            setConfirmOpen(false);
            onClose();
        } catch (err: any) {
            toast.error(apiErrorText(err));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                onCloseAutoFocus={(event) => {
                    event.preventDefault();
                    returnFocusTo.current?.focus();
                }}
            >
                <DialogHeader>
                    <DialogTitle>
                        {connected ? `Manage ${provider.name}` : `Connect ${provider.name}`}
                    </DialogTitle>
                    <DialogDescription>
                        Your store will tell {copy.company} when shoppers view products, add to cart,
                        start checkout and place an order. This lets you see which ads bring sales and
                        helps {copy.company} show your ads to likely buyers.
                    </DialogDescription>
                </DialogHeader>

                <form
                    noValidate
                    className="min-w-0 space-y-5"
                    onSubmit={(event) => {
                        event.preventDefault();
                        save();
                    }}
                >
                    <div className="space-y-2">
                        <Label htmlFor={inputId}>{provider.fieldLabel}</Label>
                        <Input
                            id={inputId}
                            type="text"
                            autoComplete="off"
                            spellCheck={false}
                            placeholder={provider.placeholder}
                            disabled={saving}
                            value={value}
                            onChange={(event) => setValue(event.target.value)}
                            onBlur={() => setTouched(true)}
                            aria-invalid={showError}
                            aria-describedby={showError ? `${inputId}-error` : undefined}
                            className="min-h-[44px]"
                        />
                        {showError && (
                            <p id={`${inputId}-error`} className="text-sm font-medium text-destructive">
                                {error}
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <h4 className="text-sm font-semibold">Where to find your ID</h4>
                        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                            {copy.steps.map((step) => (
                                <li key={step} className="break-words">
                                    {step}
                                </li>
                            ))}
                        </ol>
                    </div>

                    <div className="space-y-1">
                        <h4 className="text-sm font-semibold">Check it works</h4>
                        <p className="text-sm text-muted-foreground">{copy.check}</p>
                    </div>

                    <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                        Orders are counted when they are placed. Cash-on-delivery orders that are later
                        canceled will still be counted by {copy.company}.
                    </p>

                    <DialogFooter className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between sm:space-x-0">
                        {connected ? (
                            <Button
                                type="button"
                                variant="destructive"
                                disabled={saving}
                                className="min-h-[44px] w-full sm:w-auto"
                                onClick={() => setConfirmOpen(true)}
                            >
                                Disconnect
                            </Button>
                        ) : (
                            <span className="hidden sm:block" />
                        )}
                        <div className="flex flex-col-reverse gap-2 sm:flex-row">
                            <Button
                                type="button"
                                variant="outline"
                                disabled={saving}
                                className="min-h-[44px] w-full sm:w-auto"
                                onClick={() => onOpenChange(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={saving || Boolean(error)}
                                className="min-h-[44px] w-full sm:w-auto"
                            >
                                Save
                            </Button>
                        </div>
                    </DialogFooter>
                </form>

                {/* Rendered inside the dialog so Radix treats it as a nested layer. */}
                <Modal
                    title={`Disconnect ${provider.name}?`}
                    description="Your ID will be removed and tracking stops. You can connect again later."
                    isOpen={confirmOpen}
                    onClose={() => {
                        if (!saving) setConfirmOpen(false);
                    }}
                >
                    <div className="flex w-full flex-col-reverse items-stretch gap-2 pt-6 sm:flex-row sm:items-center sm:justify-end sm:space-x-2">
                        <Button
                            disabled={saving}
                            variant="outline"
                            className="min-h-[44px] w-full sm:w-auto"
                            onClick={() => setConfirmOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            disabled={saving}
                            variant="destructive"
                            className="min-h-[44px] w-full sm:w-auto"
                            onClick={disconnect}
                        >
                            Disconnect
                        </Button>
                    </div>
                </Modal>
            </DialogContent>
        </Dialog>
    );
}
