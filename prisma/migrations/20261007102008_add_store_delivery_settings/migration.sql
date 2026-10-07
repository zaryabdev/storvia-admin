-- CreateEnum
CREATE TYPE "DeliveryArea" AS ENUM ('ALL_PAKISTAN', 'SELECTED_CITIES');

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "deliveryArea" "DeliveryArea" NOT NULL DEFAULT 'ALL_PAKISTAN',
ADD COLUMN     "deliveryDaysMax" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "deliveryDaysMin" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "deliveryFee" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "freeDeliveryThreshold" DECIMAL(65,30);

-- CreateTable
CREATE TABLE "StoreDeliveryCity" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "cityKey" TEXT NOT NULL,
    "fee" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreDeliveryCity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoreDeliveryCity_storeId_idx" ON "StoreDeliveryCity"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreDeliveryCity_storeId_cityKey_key" ON "StoreDeliveryCity"("storeId", "cityKey");

-- AddForeignKey
ALTER TABLE "StoreDeliveryCity" ADD CONSTRAINT "StoreDeliveryCity_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
