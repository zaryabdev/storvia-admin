-- CreateEnum
CREATE TYPE "SlipPaperSize" AS ENUM ('A5', 'A4');

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "slipFooterTemplate" TEXT,
ADD COLUMN     "slipHeaderTemplate" TEXT,
ADD COLUMN     "slipPaperSize" "SlipPaperSize" NOT NULL DEFAULT 'A5';
