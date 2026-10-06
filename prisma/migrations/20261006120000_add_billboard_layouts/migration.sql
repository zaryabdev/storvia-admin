-- CreateEnum
CREATE TYPE "BillboardLayout" AS ENUM ('SPLIT', 'FULL_BLEED', 'HEADING_LED');

-- AlterTable
ALTER TABLE "Billboard" ADD COLUMN     "ctaCategoryId" TEXT,
ADD COLUMN     "ctaLabel" TEXT,
ADD COLUMN     "layout" "BillboardLayout" NOT NULL DEFAULT 'SPLIT',
ADD COLUMN     "showSearch" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "subheading" TEXT;

-- CreateTable
CREATE TABLE "BillboardImage" (
    "id" TEXT NOT NULL,
    "billboardId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillboardImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BillboardImage_billboardId_idx" ON "BillboardImage"("billboardId");

-- CreateIndex
CREATE INDEX "Billboard_ctaCategoryId_idx" ON "Billboard"("ctaCategoryId");

-- AddForeignKey
ALTER TABLE "Billboard" ADD CONSTRAINT "Billboard_ctaCategoryId_fkey" FOREIGN KEY ("ctaCategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillboardImage" ADD CONSTRAINT "BillboardImage_billboardId_fkey" FOREIGN KEY ("billboardId") REFERENCES "Billboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Data migration: every existing Billboard gets one BillboardImage (its
-- current imageUrl) at position 0, so the cover stays imageUrl. Ids are
-- uuid text, like the Prisma-generated ones (gen_random_uuid() is built
-- into PostgreSQL 13+).
INSERT INTO "BillboardImage" ("id", "billboardId", "url", "position", "createdAt")
SELECT gen_random_uuid()::text, b."id", b."imageUrl", 0, b."createdAt"
FROM "Billboard" b;
