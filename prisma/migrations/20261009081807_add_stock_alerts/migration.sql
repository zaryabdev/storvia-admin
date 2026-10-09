-- CreateEnum
CREATE TYPE "StockDisplayMode" AS ENUM ('ALWAYS', 'WHEN_LOW', 'NEVER');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "lowStockAlert" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lowStockThreshold" INTEGER;

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "lowStockThreshold" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "stockDisplayMode" "StockDisplayMode" NOT NULL DEFAULT 'WHEN_LOW';
