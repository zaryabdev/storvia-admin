-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('WEBSITE', 'MANUAL');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "source" "OrderSource" NOT NULL DEFAULT 'WEBSITE';

