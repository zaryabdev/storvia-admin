"use client"

import { useRef } from "react"

import { cn } from "@/lib/utils"

export type BillboardLayoutValue = "SPLIT" | "FULL_BLEED" | "HEADING_LED";

export const LAYOUT_OPTIONS: Array<{
  value: BillboardLayoutValue;
  label: string;
  description: string;
}> = [
  { value: "SPLIT", label: "Split", description: "Text and search beside the photo." },
  { value: "FULL_BLEED", label: "Full-bleed", description: "Photo fills the hero, text on top." },
  { value: "HEADING_LED", label: "Heading-led", description: "Big headline, search, wide photo." },
];

// Small wireframes of the three homepage heroes (decorative).
const Bar = ({ className }: { className?: string }) => (
  <div className={cn("h-1.5 rounded-full bg-muted-foreground/40", className)} />
);

const Preview = ({ layout }: { layout: BillboardLayoutValue }) => {
  if (layout === "FULL_BLEED") {
    return (
      <div className="relative h-full w-full overflow-hidden rounded bg-muted-foreground/30">
        <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute bottom-2 left-2 right-6 space-y-1">
          <div className="h-1.5 w-4/5 rounded-full bg-white" />
          <div className="h-1.5 w-3/5 rounded-full bg-white/70" />
          <div className="mt-1 h-2 w-8 rounded-full bg-white" />
        </div>
      </div>
    );
  }

  if (layout === "HEADING_LED") {
    return (
      <div className="flex h-full w-full flex-col items-center gap-1 rounded bg-muted p-1.5">
        <Bar className="h-2 w-3/4 bg-muted-foreground/60" />
        <div className="h-2 w-1/2 rounded-full border border-muted-foreground/40 bg-background" />
        <div className="w-full flex-1 rounded-sm bg-muted-foreground/30" />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full gap-1.5 rounded bg-muted p-1.5">
      <div className="flex flex-1 flex-col justify-center gap-1">
        <Bar className="h-2 w-full bg-muted-foreground/60" />
        <Bar className="w-2/3" />
        <div className="mt-0.5 h-2 w-full rounded-full border border-muted-foreground/40 bg-background" />
      </div>
      <div className="flex-1 rounded-sm bg-muted-foreground/30" />
    </div>
  );
};

interface LayoutPickerProps {
  value: BillboardLayoutValue;
  onChange: (value: BillboardLayoutValue) => void;
  disabled?: boolean;
  labelledBy?: string;
}

// Radio group of three cards. Arrow keys move the selection (roving
// tabindex), Space/Enter select the focused card.
export const LayoutPicker: React.FC<LayoutPickerProps> = ({
  value,
  onChange,
  disabled,
  labelledBy,
}) => {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const select = (index: number) => {
    const count = LAYOUT_OPTIONS.length;
    const next = (index + count) % count;
    onChange(LAYOUT_OPTIONS[next].value);
    refs.current[next]?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      select(index + 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      select(index - 1);
    }
  };

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3"
    >
      {LAYOUT_OPTIONS.map((option, index) => {
        const checked = option.value === value;

        return (
          <button
            key={option.value}
            ref={(el) => { refs.current[index] = el; }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              "flex min-h-[44px] min-w-0 items-center gap-3 rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-col sm:items-stretch",
              checked ? "border-primary ring-1 ring-primary" : "hover:bg-accent",
            )}
          >
            <div aria-hidden="true" className="h-14 w-24 shrink-0 sm:h-20 sm:w-full">
              <Preview layout={option.value} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium">{option.label}</p>
              <p className="text-xs text-muted-foreground">{option.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
};
