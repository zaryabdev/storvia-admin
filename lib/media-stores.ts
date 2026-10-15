import type { PrismaClient } from "@prisma/client";

// Per-Store image counts for the Super Admin media monitor (DECISIONS.md
// "Media monitoring (Super Admin)"). Database only, read-only, and a constant
// number of grouped queries however many Stores. Takes the client as an
// argument (no "@/" imports) so a check script can run it as-is.

export const RECENT_IMAGE_DAYS = 30;

export type StoreMedia = {
  storeId: string;
  name: string;
  productImages: number;
  billboardImages: number;
  brandingImages: number;
  paymentQrImages: number;
  totalImages: number;
  imagesLast30Days: number;
  lastImageAt: Date | null;
  productCount: number;
  archivedProductCount: number;
};

type ImageGroup = {
  storeId: string;
  total: number;
  recent: number;
  latest: Date | null;
};

const isSet = (url: string | null) => Boolean(url && url.trim());

const later = (a: Date | null, b: Date | null) => (a && b ? (a > b ? a : b) : a ?? b);

export async function getStoreMedia(db: PrismaClient, now = new Date()): Promise<StoreMedia[]> {
  // UTC now - 30 days. The columns are TIMESTAMP(3) holding UTC, and Postgres
  // ignores the zone of an ISO string cast to timestamp, so this compares UTC
  // with UTC whatever the session time zone.
  const since = new Date(now.getTime() - RECENT_IMAGE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Image and BillboardImage have no storeId: group through their parent's.
  const [stores, productGroups, qrGroups, productImageGroups, billboardImageGroups] =
    await Promise.all([
      db.store.findMany({ select: { id: true, name: true, logoUrl: true, faviconUrl: true } }),
      db.product.groupBy({ by: ["storeId", "isArchived"], _count: { _all: true } }),
      db.storePaymentAccount.groupBy({
        by: ["storeId"],
        where: { AND: [{ qrImageUrl: { not: null } }, { qrImageUrl: { not: "" } }] },
        _count: { _all: true },
      }),
      db.$queryRaw<ImageGroup[]>`
        SELECT p."storeId" AS "storeId",
               COUNT(*)::int AS "total",
               (COUNT(*) FILTER (WHERE i."createdAt" >= ${since}::timestamp))::int AS "recent",
               MAX(i."createdAt") AS "latest"
        FROM "Image" i
        JOIN "Product" p ON p."id" = i."productId"
        GROUP BY p."storeId"`,
      db.$queryRaw<ImageGroup[]>`
        SELECT b."storeId" AS "storeId",
               COUNT(*)::int AS "total",
               (COUNT(*) FILTER (WHERE bi."createdAt" >= ${since}::timestamp))::int AS "recent",
               MAX(bi."createdAt") AS "latest"
        FROM "BillboardImage" bi
        JOIN "Billboard" b ON b."id" = bi."billboardId"
        GROUP BY b."storeId"`,
    ]);

  const productImages = new Map(productImageGroups.map((group) => [group.storeId, group]));
  const billboardImages = new Map(billboardImageGroups.map((group) => [group.storeId, group]));
  const qrImages = new Map(qrGroups.map((group) => [group.storeId, group._count._all]));

  const products = new Map<string, { all: number; archived: number }>();
  for (const group of productGroups) {
    const counts = products.get(group.storeId) ?? { all: 0, archived: 0 };
    counts.all += group._count._all;
    if (group.isArchived) counts.archived += group._count._all;
    products.set(group.storeId, counts);
  }

  return stores
    .map((store) => {
      const productImage = productImages.get(store.id);
      const billboardImage = billboardImages.get(store.id);
      const brandingImages = Number(isSet(store.logoUrl)) + Number(isSet(store.faviconUrl));
      const paymentQrImages = qrImages.get(store.id) ?? 0;
      const productImageCount = productImage?.total ?? 0;
      const billboardImageCount = billboardImage?.total ?? 0;

      return {
        storeId: store.id,
        name: store.name,
        productImages: productImageCount,
        billboardImages: billboardImageCount,
        brandingImages,
        paymentQrImages,
        totalImages: productImageCount + billboardImageCount + brandingImages + paymentQrImages,
        imagesLast30Days: (productImage?.recent ?? 0) + (billboardImage?.recent ?? 0),
        lastImageAt: later(productImage?.latest ?? null, billboardImage?.latest ?? null),
        productCount: products.get(store.id)?.all ?? 0,
        archivedProductCount: products.get(store.id)?.archived ?? 0,
      };
    })
    .sort(
      (a, b) =>
        b.totalImages - a.totalImages ||
        a.name.localeCompare(b.name) ||
        a.storeId.localeCompare(b.storeId)
    );
}
