"use client";

import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import {
  CATEGORY_ICON_GROUPS,
  CATEGORY_ICONS,
  CategoryIconKey,
  isCategoryIconKey,
} from "@/lib/category-icons";
import { cn } from "@/lib/utils";

interface CategoryIconPickerProps {
  /** Selected icon key, or "" for no icon. */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const ENTRIES = Object.entries(CATEGORY_ICONS) as Array<
  [CategoryIconKey, (typeof CATEGORY_ICONS)[CategoryIconKey]]
>;

const tileClass = (selected: boolean) =>
  cn(
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-md border transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "disabled:cursor-not-allowed disabled:opacity-50",
    selected
      ? "border-primary bg-primary text-primary-foreground"
      : "border-input bg-background hover:bg-accent hover:text-accent-foreground"
  );

export function CategoryIconPicker({ value, onChange, disabled }: CategoryIconPickerProps) {
  const [query, setQuery] = useState("");

  const selected = isCategoryIconKey(value) ? CATEGORY_ICONS[value] : null;
  const SelectedIcon = selected?.icon;

  // Search spans every group: label and keywords, case-insensitive.
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (entry: (typeof CATEGORY_ICONS)[CategoryIconKey]) =>
      !q ||
      entry.label.toLowerCase().includes(q) ||
      entry.keywords.some((keyword) => keyword.toLowerCase().includes(q));

    return CATEGORY_ICON_GROUPS.map((group) => ({
      group,
      items: ENTRIES.filter(([, entry]) => entry.group === group && matches(entry)),
    })).filter(({ items }) => items.length > 0);
  }, [query]);

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex min-w-0 items-center gap-2 text-sm" aria-live="polite">
        <span className="text-muted-foreground">Selected:</span>
        {selected && SelectedIcon ? (
          <span className="flex min-w-0 items-center gap-2 font-medium">
            <SelectedIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{selected.label}</span>
          </span>
        ) : (
          <span className="font-medium">No icon</span>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          type="search"
          value={query}
          disabled={disabled}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search icons (e.g. watch, rice, phone)"
          aria-label="Search icons"
          className="min-w-0 sm:max-w-xs"
        />
        <button
          type="button"
          disabled={disabled}
          aria-pressed={!selected}
          onClick={() => onChange("")}
          className={cn(tileClass(!selected), "h-11 w-auto px-4 text-sm font-medium")}
        >
          No icon
        </button>
      </div>
      <div className="max-h-80 min-w-0 space-y-4 overflow-y-auto rounded-md border p-3">
        {groups.length === 0 && (
          <p className="text-sm text-muted-foreground">No icons match “{query.trim()}”.</p>
        )}
        {groups.map(({ group, items }) => (
          <div key={group} role="group" aria-label={group} className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {group}
            </p>
            <div className="flex flex-wrap gap-2">
              {items.map(([key, entry]) => {
                const Icon = entry.icon;
                const isSelected = value === key;

                return (
                  <button
                    key={key}
                    type="button"
                    disabled={disabled}
                    aria-label={entry.label}
                    aria-pressed={isSelected}
                    title={entry.label}
                    onClick={() => onChange(key)}
                    className={tileClass(isSelected)}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
