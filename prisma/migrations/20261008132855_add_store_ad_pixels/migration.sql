-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "metaPixelEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "metaPixelId" TEXT,
ADD COLUMN     "tiktokPixelEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "tiktokPixelId" TEXT;
