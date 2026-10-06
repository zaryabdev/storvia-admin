// Phone number rules shared by Admin and the Storefront (this file is
// byte-identical in both repos). Pure functions, no dependencies.

export const PAKISTANI_MOBILE_MESSAGE = "Enter a Pakistani mobile number, e.g. 0300 1234567";

// A Pakistani mobile in wa.me format (92 + 10 digits starting with 3), or null.
// Accepts 03XX…, +92 3XX…, 923…, 00923… and 3XX… (10 digits), with any
// spaces, dashes or brackets.
export function toPakistaniMobile(phone: string | null | undefined): string | null {
  if (typeof phone !== "string") return null;

  let digits = phone.replace(/\D/g, "");

  if (digits.startsWith("0092")) digits = digits.slice(2);
  if (/^923\d{9}$/.test(digits)) return digits;
  if (/^03\d{9}$/.test(digits)) return `92${digits.slice(1)}`;
  if (/^3\d{9}$/.test(digits)) return `92${digits}`;

  return null;
}

export function isPakistaniMobile(phone: string | null | undefined): boolean {
  return toPakistaniMobile(phone) !== null;
}

// Any phone format (mobile, landline, UAN): 7–15 digits once spaces, dashes,
// brackets and a leading + are removed. Nothing else is allowed.
export function isValidAnyPhone(phone: string | null | undefined): boolean {
  if (typeof phone !== "string") return false;

  const digits = phone.trim().replace(/^\+/, "").replace(/[\s\-()]/g, "");

  return /^\d{7,15}$/.test(digits);
}
