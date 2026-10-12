-- CreateEnum
CREATE TYPE "PaymentAccountType" AS ENUM ('BANK', 'JAZZCASH', 'EASYPAISA');

-- CreateEnum
CREATE TYPE "PaymentReceivedVia" AS ENUM ('BANK_TRANSFER', 'JAZZCASH', 'EASYPAISA', 'CASH', 'OTHER');

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'BANK_TRANSFER';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paymentReceivedVia" "PaymentReceivedVia";

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "bankTransferEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "StorePaymentAccount" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "type" "PaymentAccountType" NOT NULL,
    "position" INTEGER NOT NULL,
    "accountTitle" TEXT NOT NULL,
    "bankName" TEXT,
    "iban" TEXT,
    "accountNumber" TEXT,
    "raastId" TEXT,
    "walletNumber" TEXT,
    "tillId" TEXT,
    "qrImageUrl" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorePaymentAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StorePaymentAccount_storeId_idx" ON "StorePaymentAccount"("storeId");

-- AddForeignKey
ALTER TABLE "StorePaymentAccount" ADD CONSTRAINT "StorePaymentAccount_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
