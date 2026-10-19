-- CreateTable
CREATE TABLE "BlockedPhone" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "phoneKey" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockedPhone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BlockedPhone_storeId_idx" ON "BlockedPhone"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "BlockedPhone_storeId_phoneKey_key" ON "BlockedPhone"("storeId", "phoneKey");

-- AddForeignKey
ALTER TABLE "BlockedPhone" ADD CONSTRAINT "BlockedPhone_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
