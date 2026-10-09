// utils/trackingId.ts
import { randomBytes } from "crypto";

type TrackingIdOptions = {
    prefix?: string; // default: "ORD"
    date?: Date; // default: new Date()
    suffixLength?: number; // default: 8
    separator?: string; // default: "-"
};

/**
 * Human-friendly tracking id:
 *   ORD-YYMMDD-XXXXXXXX
 * Example:
 *   ORD-261009-8K3N7PQ4
 *
 * 8 random characters = 40 bits, so ids are not guessable (the public
 * track-order lookup relies on this). Orders before 2026-10-09 have 6.
 *
 * Uses a "safe" alphabet (no O/0, I/1) to avoid confusion.
 * Generate this SERVER-SIDE (API route / server action) to avoid duplicates.
 */
export function createTrackingId(opts: TrackingIdOptions = {}) {
    const {
        prefix = "ORD",
        date = new Date(),
        suffixLength = 8,
        separator = "-",
    } = opts;

    const yy = String(date.getFullYear()).slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const datePart = `${yy}${mm}${dd}`;

    // Safe, readable alphabet: no O/0, I/1
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    // Generate a suffix using cryptographically strong randomness
    const bytes = randomBytes(suffixLength);
    let suffix = "";
    for (let i = 0; i < suffixLength; i++) {
        suffix += alphabet[bytes[i] % alphabet.length];
    }

    return `${prefix}${separator}${datePart}${separator}${suffix}`;
}
