import { cn } from "@/lib/utils";

// Storvia app brand (Admin + Super Admin only; never the Storefront, which
// shows the merchant's brand). Not the merchant's Store logo.
// Keep this file identical in storvia-admin and storvia-super-admin.

interface StorviaLogoProps {
  /** Icon size in px. */
  size?: number;
  showWordmark?: boolean;
  className?: string;
  /** Extra classes for the wordmark, e.g. "hidden sm:inline" or a text size. */
  wordmarkClassName?: string;
}

export function StorviaLogo({
  size = 28,
  showWordmark = true,
  className,
  wordmarkClassName,
}: StorviaLogoProps) {
  // The whole lockup is one labelled image, so it is always announced as
  // "Storvia", including when the wordmark is hidden (by prop or by CSS).
  return (
    <span
      role="img"
      aria-label="Storvia"
      className={cn("inline-flex shrink-0 items-center gap-2 text-foreground", className)}
    >
      <svg
        aria-hidden="true"
        focusable="false"
        width={size}
        height={size}
        viewBox="0 0 64 64"
        className="shrink-0"
      >
        <rect width="64" height="64" rx="14" fill="#0f766e" />
        <path
          d="M40 18H26a9 9 0 0 0 0 18h12a9 9 0 0 1 0 18H20"
          fill="none"
          stroke="#fff"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="49" cy="18" r="3.5" fill="#fff" />
      </svg>
      {showWordmark && (
        <span
          aria-hidden="true"
          className={cn("text-lg font-semibold leading-none tracking-tight", wordmarkClassName)}
        >
          Storvia
        </span>
      )}
    </span>
  );
}
