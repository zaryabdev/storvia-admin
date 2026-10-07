"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export const SETTINGS_TABS = [
    { key: "store", label: "Store" },
    { key: "delivery", label: "Delivery" },
    { key: "messages", label: "Messages" },
    { key: "packing-slips", label: "Packing slips" },
    { key: "billing", label: "Billing" },
] as const;

export type SettingsTabKey = (typeof SETTINGS_TABS)[number]["key"];

export const DEFAULT_SETTINGS_TAB: SettingsTabKey = "store";

// The `?tab=` value, or the default when missing or invalid.
export const parseSettingsTab = (value: unknown): SettingsTabKey =>
    SETTINGS_TABS.find((tab) => tab.key === value)?.key ?? DEFAULT_SETTINGS_TAB;

interface SettingsTabsProps {
    /** The tab read from `?tab=` on the server. */
    initialTab: SettingsTabKey;
    /** One server-rendered panel per tab. */
    panels: Record<SettingsTabKey, React.ReactNode>;
}

// Tabbed Settings. Every panel stays mounted (inactive ones are `hidden`), so
// unsaved edits survive tab switches. The URL holds the tab (`?tab=`), updated
// with router.replace and no scroll jump.
export function SettingsTabs({ initialTab, panels }: SettingsTabsProps) {
    const router = useRouter();
    const pathname = usePathname();
    const [active, setActive] = useState<SettingsTabKey>(initialTab);
    const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

    // A link that targets another tab while Settings is open.
    useEffect(() => {
        setActive(initialTab);
    }, [initialTab]);

    // Phones: the tab bar scrolls sideways; keep the active tab in view.
    useEffect(() => {
        tabRefs.current[active]?.scrollIntoView({ inline: "center", block: "nearest" });
    }, [active]);

    const select = (key: SettingsTabKey, focus = false) => {
        setActive(key);
        router.replace(`${pathname}?tab=${key}`, { scroll: false });
        if (focus) tabRefs.current[key]?.focus();
    };

    const onKeyDown = (event: React.KeyboardEvent, index: number) => {
        const last = SETTINGS_TABS.length - 1;
        const next =
            event.key === "ArrowRight"
                ? (index + 1) % SETTINGS_TABS.length
                : event.key === "ArrowLeft"
                  ? (index - 1 + SETTINGS_TABS.length) % SETTINGS_TABS.length
                  : event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? last
                      : null;

        if (next === null) return;

        event.preventDefault();
        select(SETTINGS_TABS[next].key, true);
    };

    return (
        <div className="min-w-0 space-y-6">
            <div
                role="tablist"
                aria-label="Settings sections"
                className="-mx-4 flex overflow-x-auto border-b px-4 sm:mx-0 sm:px-0"
            >
                {SETTINGS_TABS.map((tab, index) => {
                    const selected = tab.key === active;

                    return (
                        <button
                            key={tab.key}
                            ref={(el) => {
                                tabRefs.current[tab.key] = el;
                            }}
                            type="button"
                            role="tab"
                            id={`settings-tab-${tab.key}`}
                            aria-selected={selected}
                            aria-controls={`settings-panel-${tab.key}`}
                            tabIndex={selected ? 0 : -1}
                            onClick={() => select(tab.key)}
                            onKeyDown={(event) => onKeyDown(event, index)}
                            className={cn(
                                "-mb-px min-h-[44px] shrink-0 whitespace-nowrap border-b-2 px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                selected
                                    ? "border-primary text-foreground"
                                    : "border-transparent text-muted-foreground hover:text-foreground",
                            )}
                        >
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {SETTINGS_TABS.map((tab) => (
                <div
                    key={tab.key}
                    role="tabpanel"
                    id={`settings-panel-${tab.key}`}
                    aria-labelledby={`settings-tab-${tab.key}`}
                    hidden={tab.key !== active}
                    className="min-w-0 space-y-4 focus-visible:outline-none"
                >
                    {panels[tab.key]}
                </div>
            ))}
        </div>
    );
}
