import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";

import { apiError } from "@/lib/billing-plan";
import {
  PUBLIC_PAYMENT_ACCOUNT_SELECT,
  normalizePaymentSettings,
  toMerchantPaymentAccount,
  type PaymentSettingsBody,
} from "@/lib/payment-accounts";
import { PAYMENT_ACCOUNT_ORDER } from "@/lib/payment-settings";
import prismadb from "@/lib/prismadb";

export const dynamic = "force-dynamic";

// Only the payment columns: Store has Decimal columns, never return a full row.
const ACCOUNT_SELECT = { id: true, ...PUBLIC_PAYMENT_ACCOUNT_SELECT } as const;

// Merchant-owned, authenticated. 401 unauthenticated, 404 unknown Store,
// 403 Store owned by someone else. Customers see the accounts only through
// /checkout (BANK_TRANSFER) and /track-order (unpaid bank transfer orders).
async function loadOwnedStore(storeId: string) {
  const { userId } = auth();
  if (!userId) return { store: null, denied: new NextResponse("Unauthenticated", { status: 401 }) };

  const store = await prismadb.store.findUnique({
    where: { id: storeId },
    select: {
      id: true,
      userId: true,
      bankTransferEnabled: true,
      paymentAccounts: { orderBy: PAYMENT_ACCOUNT_ORDER, select: ACCOUNT_SELECT },
    },
  });
  if (!store) return { store: null, denied: apiError(404, "STORE_NOT_FOUND", "Store not found.") };
  if (store.userId !== userId) return { store: null, denied: new NextResponse("Forbidden", { status: 403 }) };

  return { store, denied: null };
}

// GET /api/stores/:storeId/payment-settings
// -> { enabled, accounts: [{ id, type, accountTitle, bankName, iban,
//      accountNumber, raastId, walletNumber, tillId, qrImageUrl, note }] }
export async function GET(_req: Request, { params }: { params: { storeId: string } }) {
  try {
    const { store, denied } = await loadOwnedStore(params.storeId);
    if (denied || !store) return denied;

    const body: PaymentSettingsBody = {
      enabled: store.bankTransferEnabled,
      accounts: store.paymentAccounts.map(toMerchantPaymentAccount),
    };

    return NextResponse.json(body);
  } catch (error) {
    console.error("[STORE_PAYMENT_SETTINGS_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

// PUT /api/stores/:storeId/payment-settings
// Body: the full object (same shape as GET; account ids are ignored). Validated
// by normalizePaymentSettings before any write (400 plain text, first problem).
// The Store flag and the accounts (delete all + create, position = index) are
// replaced in one transaction. Returns the GET shape (new account ids).
export async function PUT(req: Request, { params }: { params: { storeId: string } }) {
  try {
    const { store, denied } = await loadOwnedStore(params.storeId);
    if (denied || !store) return denied;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new NextResponse("Invalid request body", { status: 400 });
    }

    const result = normalizePaymentSettings(body);
    if ("error" in result) return new NextResponse(result.error, { status: 400 });

    const settings = result.value;

    const [updated, , , accounts] = await prismadb.$transaction([
      prismadb.store.update({
        where: { id: store.id },
        data: { bankTransferEnabled: settings.enabled },
        select: { bankTransferEnabled: true },
      }),
      prismadb.storePaymentAccount.deleteMany({ where: { storeId: store.id } }),
      prismadb.storePaymentAccount.createMany({
        data: settings.accounts.map((account, index) => ({ ...account, storeId: store.id, position: index })),
      }),
      prismadb.storePaymentAccount.findMany({
        where: { storeId: store.id },
        orderBy: PAYMENT_ACCOUNT_ORDER,
        select: ACCOUNT_SELECT,
      }),
    ]);

    const response: PaymentSettingsBody = {
      enabled: updated.bankTransferEnabled,
      accounts: accounts.map(toMerchantPaymentAccount),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[STORE_PAYMENT_SETTINGS_PUT]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
