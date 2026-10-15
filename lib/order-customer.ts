// The required customer/shipping fields of an order, shared by the checkout
// routes (lib/order-create.ts) and the Admin "New order" form. Pure, no Prisma,
// so it is safe in the browser. Postal code, email, line 2 and notes are
// optional. Rules: DECISIONS.md → Checkout phone, postal code and sender details.

import { PAKISTANI_MOBILE_MESSAGE, isPakistaniMobile } from "./phone";

// Trimmed string, or "" for a missing or non-string value.
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export type CustomerField = "name" | "phone" | "line1" | "city";

// The plain-text message for one required field, or null when it is valid.
// `city` is valid when either the city text or the city key is set.
export function customerFieldError(field: CustomerField, value: unknown, cityKey?: unknown): string | null {
    switch (field) {
        case "name":
            return text(value) ? null : "Name is required";
        case "phone":
            if (!text(value)) return "Phone is required";
            return isPakistaniMobile(text(value)) ? null : PAKISTANI_MOBILE_MESSAGE;
        case "line1":
            return text(value) ? null : "Address line 1 is required";
        case "city":
            return text(value) || text(cityKey) ? null : "City is required";
    }
}

// The first problem, in the order the Storefront shows them, or null.
export function customerDetailsError(payload: {
    customer?: { name?: unknown; phone?: unknown };
    shipping?: { line1?: unknown; city?: unknown; cityKey?: unknown };
}): string | null {
    return (
        customerFieldError("name", payload.customer?.name) ??
        customerFieldError("phone", payload.customer?.phone) ??
        customerFieldError("line1", payload.shipping?.line1) ??
        customerFieldError("city", payload.shipping?.city, payload.shipping?.cityKey)
    );
}
