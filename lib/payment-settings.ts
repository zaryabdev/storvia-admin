// Server reads of a Store's payment accounts (Prisma). The rules and shapes
// live in lib/payment-accounts.ts.

import {
  PUBLIC_PAYMENT_ACCOUNT_SELECT,
  isBankTransferAvailable,
  toPublicPaymentAccount,
  type PublicPaymentAccount,
} from "./payment-accounts";
import prismadb from "./prismadb";

// Merchant order; legacy ties (none expected) break by creation time.
export const PAYMENT_ACCOUNT_ORDER = [{ position: "asc" as const }, { createdAt: "asc" as const }];

// The Store's accounts in the public shape, in order ([] for none or an unknown Store).
export async function loadPublicPaymentAccounts(storeId: string): Promise<PublicPaymentAccount[]> {
  const rows = await prismadb.storePaymentAccount.findMany({
    where: { storeId },
    orderBy: PAYMENT_ACCOUNT_ORDER,
    select: PUBLIC_PAYMENT_ACCOUNT_SELECT,
  });

  return rows.map(toPublicPaymentAccount);
}

// Whether checkout may offer bank transfer, with the accounts to show.
// An unknown Store is "not available".
export async function loadBankTransferOption(
  storeId: string,
): Promise<{ available: boolean; accounts: PublicPaymentAccount[] }> {
  const store = await prismadb.store.findUnique({
    where: { id: storeId },
    select: {
      bankTransferEnabled: true,
      paymentAccounts: { orderBy: PAYMENT_ACCOUNT_ORDER, select: PUBLIC_PAYMENT_ACCOUNT_SELECT },
    },
  });

  if (!store) return { available: false, accounts: [] };

  return {
    available: isBankTransferAvailable(store.bankTransferEnabled, store.paymentAccounts.length),
    accounts: store.paymentAccounts.map(toPublicPaymentAccount),
  };
}
