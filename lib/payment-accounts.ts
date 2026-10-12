// Bank transfer / mobile wallet payment accounts: validation, IBAN rules, the
// public shape and the {bank_details} text. Pure functions, no Prisma or React,
// shared by the merchant route, /checkout, /track-order, the order templates and
// the Settings form (client-side validation with the server's messages).
// Rules: DECISIONS.md → Bank transfer and mobile wallet payments.

import { PAKISTANI_MOBILE_MESSAGE, isPakistaniMobile } from "./phone";

export const PAYMENT_ACCOUNT_TYPES = ["BANK", "JAZZCASH", "EASYPAISA"] as const;
export type PaymentAccountTypeValue = (typeof PAYMENT_ACCOUNT_TYPES)[number];

export const PAYMENT_ACCOUNT_TYPE_LABELS: Record<PaymentAccountTypeValue, string> = {
  BANK: "Bank account",
  JAZZCASH: "JazzCash",
  EASYPAISA: "Easypaisa",
};

export const MAX_PAYMENT_ACCOUNTS = 10;
export const MAX_ACCOUNT_TITLE_LENGTH = 100;
export const MAX_BANK_NAME_LENGTH = 60;
export const MAX_ACCOUNT_NOTE_LENGTH = 300;
const MAX_URL_LENGTH = 2048;

export const IBAN_MESSAGE = "Enter a valid Pakistani IBAN (24 characters, starts with PK)";
export const NO_ACCOUNTS_MESSAGE = "Add at least one account, or turn off bank transfer";
export const WALLET_REQUIRED_MESSAGE = "Add a mobile number, Till ID or QR code";

export const isPaymentAccountType = (value: unknown): value is PaymentAccountTypeValue =>
  typeof value === "string" && (PAYMENT_ACCOUNT_TYPES as readonly string[]).includes(value);

// What customers see (checkout response, order tracking). No ids, in position order.
export interface PublicPaymentAccount {
  type: PaymentAccountTypeValue;
  accountTitle: string;
  bankName: string | null;
  iban: string | null;
  accountNumber: string | null;
  raastId: string | null;
  walletNumber: string | null;
  tillId: string | null;
  qrImageUrl: string | null;
  note: string | null;
}

// The merchant API shape: the public fields plus the row id.
export type MerchantPaymentAccount = PublicPaymentAccount & { id: string };

export interface PaymentSettingsBody {
  enabled: boolean;
  accounts: MerchantPaymentAccount[];
}

// Normalised settings, ready to store (position = array index).
export interface PaymentSettings {
  enabled: boolean;
  accounts: PublicPaymentAccount[];
}

// The columns behind PublicPaymentAccount, for Prisma selects.
export const PUBLIC_PAYMENT_ACCOUNT_SELECT = {
  type: true,
  accountTitle: true,
  bankName: true,
  iban: true,
  accountNumber: true,
  raastId: true,
  walletNumber: true,
  tillId: true,
  qrImageUrl: true,
  note: true,
} as const;

// The one serializer for the public shape (shared by /checkout and /track-order).
export const toPublicPaymentAccount = (row: PublicPaymentAccount): PublicPaymentAccount => ({
  type: row.type,
  accountTitle: row.accountTitle,
  bankName: row.bankName,
  iban: row.iban,
  accountNumber: row.accountNumber,
  raastId: row.raastId,
  walletNumber: row.walletNumber,
  tillId: row.tillId,
  qrImageUrl: row.qrImageUrl,
  note: row.note,
});

export const toMerchantPaymentAccount = (row: MerchantPaymentAccount): MerchantPaymentAccount => ({
  id: row.id,
  ...toPublicPaymentAccount(row),
});

// Bank transfer is offered at checkout only while enabled AND at least one account exists.
export const isBankTransferAvailable = (enabled: boolean, accountCount: number) =>
  enabled && accountCount > 0;

// ---------------------------------------------------------------------------
// IBAN (Pakistan)

const PK_IBAN = /^PK\d{2}[A-Z]{4}[A-Z0-9]{16}$/;

// Spaces and dashes removed, uppercase. Not validated.
export const normalizeIban = (value: string) => value.replace(/[\s-]/g, "").toUpperCase();

// ISO 13616 mod-97: move the first four characters to the end, letters become
// 10–35, and the number mod 97 must be 1. Computed in chunks (no BigInt).
export function ibanChecksumIsValid(iban: string): boolean {
  if (!/^[A-Z0-9]+$/.test(iban) || iban.length < 5) return false;

  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;

  for (const char of rearranged.split("")) {
    const digits = /[A-Z]/.test(char) ? String(char.charCodeAt(0) - 55) : char;
    remainder = Number(String(remainder) + digits) % 97;
  }

  return remainder === 1;
}

// A normalised IBAN (normalizeIban) that is a valid Pakistani IBAN.
export const isPakistaniIban = (iban: string) => PK_IBAN.test(iban) && ibanChecksumIsValid(iban);

// "PK36 SCBL 0000 0011 2345 6702" (display only).
export const formatIban = (iban: string) => iban.replace(/(.{4})(?=.)/g, "$1 ");

// ---------------------------------------------------------------------------
// Validation

type FieldResult = { ok: true; value: string | null } | { ok: false };

// A trimmed string, null for missing/blank, or not ok for a non-string.
function optionalText(raw: unknown): FieldResult {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false };

  const trimmed = raw.trim();
  return { ok: true, value: trimmed === "" ? null : trimmed };
}

// Same rule as the Store logo: a trimmed https: URL of at most 2048 characters.
function isHttpsUrl(value: string) {
  if (value.length > MAX_URL_LENGTH) return false;

  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

// Digits, spaces and dashes, 4–30 characters, with at least 4 digits.
const ACCOUNT_NUMBER = /^[0-9 -]{4,30}$/;
const MIN_ACCOUNT_NUMBER_DIGITS = 4;
const TILL_ID = /^[A-Za-z0-9]{3,20}$/;

type AccountResult = { value: PublicPaymentAccount } | { error: string };

// One account's first problem (without the "Account N: " prefix), or the
// normalised account.
function normalizeAccount(raw: unknown): AccountResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { error: "Invalid account" };

  const input = raw as Record<string, unknown>;

  if (!isPaymentAccountType(input.type)) return { error: "Choose an account type" };
  const type = input.type;

  const fields = {
    accountTitle: optionalText(input.accountTitle),
    bankName: optionalText(input.bankName),
    iban: optionalText(input.iban),
    accountNumber: optionalText(input.accountNumber),
    raastId: optionalText(input.raastId),
    walletNumber: optionalText(input.walletNumber),
    tillId: optionalText(input.tillId),
    qrImageUrl: optionalText(input.qrImageUrl),
    note: optionalText(input.note),
  };

  for (const field of Object.values(fields)) {
    if (!field.ok) return { error: "Invalid account" };
  }

  const value = (key: keyof typeof fields) => {
    const field = fields[key];
    return field.ok ? field.value : null;
  };

  const accountTitle = value("accountTitle");
  if (!accountTitle) return { error: "Account title is required" };
  if (accountTitle.length > MAX_ACCOUNT_TITLE_LENGTH) {
    return { error: `Account title must be at most ${MAX_ACCOUNT_TITLE_LENGTH} characters` };
  }

  const account: PublicPaymentAccount = {
    type,
    accountTitle,
    bankName: null,
    iban: null,
    accountNumber: null,
    raastId: null,
    walletNumber: null,
    tillId: null,
    qrImageUrl: null,
    note: null,
  };

  if (type === "BANK") {
    if (value("walletNumber") !== null || value("tillId") !== null) {
      return { error: "A bank account can't have a wallet number or Till ID" };
    }

    const bankName = value("bankName");
    if (!bankName) return { error: "Bank name is required" };
    if (bankName.length > MAX_BANK_NAME_LENGTH) {
      return { error: `Bank name must be at most ${MAX_BANK_NAME_LENGTH} characters` };
    }

    const rawIban = value("iban");
    if (!rawIban) return { error: "IBAN is required" };
    const iban = normalizeIban(rawIban);
    if (!isPakistaniIban(iban)) return { error: IBAN_MESSAGE };

    const accountNumber = value("accountNumber");
    if (accountNumber !== null && !ACCOUNT_NUMBER.test(accountNumber)) {
      return { error: "Account number must be 4–30 digits, spaces or dashes" };
    }
    if (accountNumber !== null && accountNumber.replace(/\D/g, "").length < MIN_ACCOUNT_NUMBER_DIGITS) {
      return { error: `Account number must contain at least ${MIN_ACCOUNT_NUMBER_DIGITS} digits` };
    }

    const raastId = value("raastId");
    if (raastId !== null && !isPakistaniMobile(raastId)) {
      return { error: "Raast ID must be a Pakistani mobile number, e.g. 0300 1234567" };
    }

    Object.assign(account, { bankName, iban, accountNumber, raastId });
  } else {
    if (
      value("bankName") !== null ||
      value("iban") !== null ||
      value("accountNumber") !== null ||
      value("raastId") !== null
    ) {
      return { error: `A ${PAYMENT_ACCOUNT_TYPE_LABELS[type]} account can't have bank details` };
    }

    const walletNumber = value("walletNumber");
    if (walletNumber !== null && !isPakistaniMobile(walletNumber)) {
      return { error: PAKISTANI_MOBILE_MESSAGE };
    }

    const tillId = value("tillId");
    if (tillId !== null && !TILL_ID.test(tillId)) {
      return { error: "Till ID must be 3–20 letters and numbers" };
    }

    if (walletNumber === null && tillId === null && value("qrImageUrl") === null) {
      return { error: WALLET_REQUIRED_MESSAGE };
    }

    Object.assign(account, { walletNumber, tillId });
  }

  const qrImageUrl = value("qrImageUrl");
  if (qrImageUrl !== null && !isHttpsUrl(qrImageUrl)) return { error: "Invalid QR code image URL" };

  const note = value("note");
  if (note !== null && note.length > MAX_ACCOUNT_NOTE_LENGTH) {
    return { error: `Note must be at most ${MAX_ACCOUNT_NOTE_LENGTH} characters` };
  }

  return { value: { ...account, qrImageUrl, note } };
}

// The first problem with one account, prefixed with its 1-based position
// ("Account 2: …"), or null when it is valid.
export function paymentAccountError(raw: unknown, index: number): string | null {
  const result = normalizeAccount(raw);
  return "error" in result ? `Account ${index + 1}: ${result.error}` : null;
}

// Validates the full settings object (PUT body, same shape as the GET; ids are
// ignored). First problem only, as plain text; nothing is partially accepted.
export function normalizePaymentSettings(body: unknown): { value: PaymentSettings } | { error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Invalid request body" };

  const { enabled, accounts } = body as Record<string, unknown>;

  if (typeof enabled !== "boolean" || !Array.isArray(accounts)) return { error: "Invalid request body" };
  if (accounts.length > MAX_PAYMENT_ACCOUNTS) {
    return { error: `You can add at most ${MAX_PAYMENT_ACCOUNTS} accounts` };
  }

  const normalized: PublicPaymentAccount[] = [];

  for (let index = 0; index < accounts.length; index++) {
    const result = normalizeAccount(accounts[index]);
    if ("error" in result) return { error: `Account ${index + 1}: ${result.error}` };
    normalized.push(result.value);
  }

  if (enabled && normalized.length === 0) return { error: NO_ACCOUNTS_MESSAGE };

  return { value: { enabled, accounts: normalized } };
}

// ---------------------------------------------------------------------------
// {bank_details}: one block per account, blank line between blocks. Note and
// QR are left out. "" when there are no accounts.

export function formatBankDetails(accounts: readonly PublicPaymentAccount[] | null | undefined): string {
  return (accounts ?? [])
    .map((account) => {
      const lines =
        account.type === "BANK"
          ? [
              account.bankName ?? "",
              `Title: ${account.accountTitle}`,
              account.iban ? `IBAN: ${formatIban(account.iban)}` : "",
              account.accountNumber ? `Account: ${account.accountNumber}` : "",
              account.raastId ? `Raast ID: ${account.raastId}` : "",
            ]
          : [
              PAYMENT_ACCOUNT_TYPE_LABELS[account.type],
              `Title: ${account.accountTitle}`,
              account.walletNumber ? `Number: ${account.walletNumber}` : "",
              account.tillId ? `Till ID: ${account.tillId}` : "",
            ];

      return lines.filter(Boolean).join("\n");
    })
    .join("\n\n");
}
