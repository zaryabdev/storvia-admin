-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "announcementEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "announcementText" TEXT,
ADD COLUMN     "facebookUrl" TEXT,
ADD COLUMN     "instagramUrl" TEXT,
ADD COLUMN     "tiktokUrl" TEXT;
