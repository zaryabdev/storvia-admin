// Settings tab keys and the `?tab=` parser. A plain module (no "use client"):
// both the server page and the client SettingsTabs component import it, and a
// server file must never call helpers that live in a "use client" file.

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
