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
import { Switch } from "@/components/ui/switch";
import {
    MAX_ANNOUNCEMENT_LENGTH,
    SOCIAL_NETWORKS,
    codePointLength,
    collapseAnnouncement,
    normalizeSocialLink,
    parseStorefrontSettingsPatch,
    type SocialNetwork,
    type StorefrontSettings,
} from "@/lib/storefront-settings";

interface StorefrontSectionProps {
    storeId: string;
    /** The saved settings, in the merchant API shape. */
    initialSettings: StorefrontSettings;
}

// The API's 400 text, else a generic message.
const saveErrorMessage = (err: any) => {
    const text = err?.response?.data;
    return err?.response?.status === 400 && typeof text === "string" && text ? text : "Something went wrong.";
};

export function StorefrontSection({ storeId, initialSettings }: StorefrontSectionProps) {
    return (
        <>
            <AnnouncementForm storeId={storeId} initialSettings={initialSettings} />
            <div className="border-t pt-8">
                <SocialLinksForm storeId={storeId} initialSettings={initialSettings} />
            </div>
        </>
    );
}

function AnnouncementForm({ storeId, initialSettings }: StorefrontSectionProps) {
    const router = useRouter();
    const [text, setText] = useState(initialSettings.announcementText ?? "");
    const [enabled, setEnabled] = useState(initialSettings.announcementEnabled);
    const [dirty, setDirty] = useState(false);
    const [loading, setLoading] = useState(false);

    // Same rules as the server (lib/storefront-settings.ts), so the message
    // matches its 400.
    const body = { announcementText: text, announcementEnabled: enabled };
    const parsed = parseStorefrontSettingsPatch(body, initialSettings);
    const error = "error" in parsed ? parsed.error : null;

    const preview = collapseAnnouncement(text);
    const length = codePointLength(preview);

    const save = async () => {
        if (error) return;

        try {
            setLoading(true);
            const { data } = await axios.patch<StorefrontSettings>(
                `/api/stores/${storeId}/storefront-settings`,
                body,
            );
            setText(data.announcementText ?? "");
            setEnabled(data.announcementEnabled);
            setDirty(false);
            router.refresh();
            toast.success("Announcement saved.");
        } catch (err: any) {
            toast.error(saveErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-w-0 space-y-4">
            <Heading
                title="Announcement bar"
                description="A short message above the header, such as a sale or delivery notice."
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
                <div className="flex min-h-[44px] items-center gap-3">
                    <Switch
                        id="announcement-enabled"
                        checked={enabled}
                        disabled={loading}
                        onCheckedChange={(next) => {
                            setEnabled(next);
                            setDirty(true);
                        }}
                    />
                    <Label htmlFor="announcement-enabled" className="cursor-pointer leading-snug">
                        Show announcement bar
                    </Label>
                </div>

                <div className="min-w-0 space-y-2 md:max-w-xl">
                    <div className="flex items-baseline justify-between gap-3">
                        <Label htmlFor="announcement-text">Announcement</Label>
                        <span
                            className={`shrink-0 text-sm tabular-nums ${length > MAX_ANNOUNCEMENT_LENGTH ? "font-medium text-destructive" : "text-muted-foreground"}`}
                            aria-live="polite"
                        >
                            {length} / {MAX_ANNOUNCEMENT_LENGTH}
                        </span>
                    </div>
                    <Input
                        id="announcement-text"
                        dir="auto"
                        className="h-11"
                        placeholder="Free delivery on orders over Rs 3,000"
                        disabled={loading}
                        value={text}
                        onChange={(e) => {
                            setText(e.target.value);
                            setDirty(true);
                        }}
                        aria-invalid={dirty && Boolean(error)}
                        aria-describedby="announcement-hint"
                    />
                    <p id="announcement-hint" className="text-sm text-muted-foreground">
                        Shown above the header on every page of your shop. Plain text only.
                    </p>
                    {dirty && error ? (
                        <p role="alert" className="text-sm font-medium text-destructive">
                            {error}
                        </p>
                    ) : null}
                </div>

                <div className="min-w-0 space-y-2 md:max-w-xl">
                    <p className="text-sm font-medium">Preview</p>
                    {enabled && preview ? (
                        <p
                            dir="auto"
                            className="break-words rounded-md bg-foreground px-3 py-2 text-center text-sm text-background"
                        >
                            {preview}
                        </p>
                    ) : (
                        <p className="rounded-md border border-dashed px-3 py-2 text-center text-sm text-muted-foreground">
                            {enabled ? "Add text to show the bar." : "The bar is hidden on your shop."}
                        </p>
                    )}
                </div>

                <Button type="submit" disabled={loading || Boolean(error)} className="h-11 w-full sm:w-auto">
                    Save
                </Button>
            </form>
        </div>
    );
}

type SocialInputs = Record<SocialNetwork, string>;

const toInputs = (settings: StorefrontSettings): SocialInputs => ({
    instagram: settings.instagram ?? "",
    tiktok: settings.tiktok ?? "",
    facebook: settings.facebook ?? "",
});

function SocialLinksForm({ storeId, initialSettings }: StorefrontSectionProps) {
    const router = useRouter();
    const [inputs, setInputs] = useState<SocialInputs>(() => toInputs(initialSettings));
    const [touched, setTouched] = useState<Record<SocialNetwork, boolean>>({
        instagram: false,
        tiktok: false,
        facebook: false,
    });
    const [loading, setLoading] = useState(false);

    // Same rule as the server: each input becomes the canonical URL it stores.
    const results = {
        instagram: normalizeSocialLink("instagram", inputs.instagram),
        tiktok: normalizeSocialLink("tiktok", inputs.tiktok),
        facebook: normalizeSocialLink("facebook", inputs.facebook),
    };
    const invalid = SOCIAL_NETWORKS.some(({ key }) => "error" in results[key]);

    const save = async () => {
        setTouched({ instagram: true, tiktok: true, facebook: true });
        if (invalid) return;

        try {
            setLoading(true);
            const { data } = await axios.patch<StorefrontSettings>(
                `/api/stores/${storeId}/storefront-settings`,
                inputs,
            );
            setInputs(toInputs(data));
            router.refresh();
            toast.success("Social links saved.");
        } catch (err: any) {
            toast.error(saveErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-w-0 space-y-4">
            <Heading
                title="Social links"
                description="Link your shop to your social profiles. Leave a field empty to hide it."
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
                <div className="grid min-w-0 grid-cols-1 gap-6 md:max-w-xl">
                    {SOCIAL_NETWORKS.map(({ key, label }) => {
                        const result = results[key];
                        const error = "error" in result ? result.error : null;
                        const url = "url" in result ? result.url : null;
                        const id = `social-${key}`;

                        return (
                            <div key={key} className="min-w-0 space-y-2">
                                <Label htmlFor={id}>{label}</Label>
                                <Input
                                    id={id}
                                    type="text"
                                    inputMode="url"
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    className="h-11"
                                    placeholder="@yourshop or profile link"
                                    disabled={loading}
                                    value={inputs[key]}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setInputs((prev) => ({ ...prev, [key]: value }));
                                    }}
                                    onBlur={() => setTouched((prev) => ({ ...prev, [key]: true }))}
                                    aria-invalid={touched[key] && Boolean(error)}
                                    aria-describedby={`${id}-result`}
                                />
                                <div id={`${id}-result`} aria-live="polite" className="min-w-0">
                                    {touched[key] && error ? (
                                        <p className="text-sm font-medium text-destructive">{error}</p>
                                    ) : touched[key] && url ? (
                                        <p className="break-all text-sm text-muted-foreground">
                                            Links to: <span className="text-foreground">{url}</span>
                                        </p>
                                    ) : null}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <Button type="submit" disabled={loading || invalid} className="h-11 w-full sm:w-auto">
                    Save
                </Button>
            </form>
        </div>
    );
}
