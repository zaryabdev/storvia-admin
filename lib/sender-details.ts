// Sender details (the return address on packing slips). Pure validation shared
// by the merchant route and the Settings form. All four fields are required.

import { isValidAnyPhone } from "./phone";

export type SenderDetails = {
  senderName: string;
  senderPhone: string;
  senderAddress: string;
  senderCity: string;
};

export const SENDER_FIELDS: {
  key: keyof SenderDetails;
  label: string;
  max: number;
}[] = [
  { key: "senderName", label: "Sender name", max: 100 },
  { key: "senderPhone", label: "Sender phone", max: 0 },
  { key: "senderAddress", label: "Sender address", max: 200 },
  { key: "senderCity", label: "Sender city", max: 60 },
];

// The first problem with one field, or null when it is valid.
export function senderFieldError(key: keyof SenderDetails, value: unknown): string | null {
  const field = SENDER_FIELDS.find((f) => f.key === key)!;

  if (typeof value !== "string" || !value.trim()) return `${field.label} is required`;

  const trimmed = value.trim();

  if (key === "senderPhone") {
    return isValidAnyPhone(trimmed) ? null : "Sender phone is not a valid phone number";
  }

  return trimmed.length > field.max
    ? `${field.label} must be at most ${field.max} characters`
    : null;
}

// Validates a request body: all four fields, trimmed. Returns the first error.
export function parseSenderDetails(
  body: unknown,
): { error: string } | { value: SenderDetails } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Invalid request body" };
  }

  const input = body as Record<string, unknown>;
  const value = {} as SenderDetails;

  for (const { key } of SENDER_FIELDS) {
    const error = senderFieldError(key, input[key]);
    if (error) return { error };
    value[key] = (input[key] as string).trim();
  }

  return { value };
}

export const isSenderDetailsComplete = (details: {
  [K in keyof SenderDetails]: string | null;
}): boolean => SENDER_FIELDS.every(({ key }) => Boolean(details[key]?.trim()));
