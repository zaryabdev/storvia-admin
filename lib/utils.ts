import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export const formatter = new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
});

const compactFormatter = new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
});

// Short PKR label for chart axes: "PKR 0", "PKR 950", "PKR 12.5K", "PKR 1.3M".
export const formatPkrCompact = (value: number) =>
    `PKR ${compactFormatter.format(value)}`;
