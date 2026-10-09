import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';

import prismadb from '@/lib/prismadb';
import { buildProductSearchFilter, parseSearchTerms } from '@/lib/product-search';
import { findForeignReference } from '@/lib/store-scope';
import { parseCompareAtPrice, parseProductsLimit } from '@/lib/compare-at-price';
import { PRODUCT_IMAGE_ORDER, toImageRows, validateProductImages } from '@/lib/product-images';
import { DEFAULT_STOCK_SETTINGS, STOCK_SETTINGS_SELECT, parseLowStockAlert, parseProductLowStockThreshold, stockDisplay } from '@/lib/stock';

export async function POST(
  req: Request,
  { params }: { params: { storeId: string } }
) {
  try {
    const { userId } = auth();

    const body = await req.json();

    const { name, price, compareAtPrice, quantity, lowStockAlert, lowStockThreshold, categoryId, colorId, sizeId, images, isFeatured, isArchived } = body;

    if (!userId) {
      return new NextResponse("Unauthenticated", { status: 401 });
    }

    if (!name) {
      return new NextResponse("Name is required", { status: 400 });
    }

    if (!images || !images.length) {
      return new NextResponse("Images are required", { status: 400 });
    }

    const imagesError = validateProductImages(images);

    if (imagesError) {
      return new NextResponse(imagesError, { status: 400 });
    }

    if (!price) {
      return new NextResponse("Price is required", { status: 400 });
    }

    const compareAt = parseCompareAtPrice(compareAtPrice, price);

    if ("error" in compareAt) {
      return new NextResponse(compareAt.error, { status: 400 });
    }

    if (typeof quantity !== 'number' || quantity < 0) {
      return new NextResponse("A valid quantity is required", { status: 400 });
    }

    // Missing = on (the column default); otherwise a boolean.
    const stockAlert = parseLowStockAlert(lowStockAlert);

    if ("error" in stockAlert) {
      return new NextResponse(stockAlert.error, { status: 400 });
    }

    // Missing / null / "" = none (use the Store default); otherwise 1–1000.
    const stockThreshold = parseProductLowStockThreshold(lowStockThreshold);

    if ("error" in stockThreshold) {
      return new NextResponse(stockThreshold.error, { status: 400 });
    }

    if (!categoryId) {
      return new NextResponse("Category id is required", { status: 400 });
    }

    if (!colorId) {
      return new NextResponse("Color id is required", { status: 400 });
    }

    if (!sizeId) {
      return new NextResponse("Size id is required", { status: 400 });
    }

    if (!params.storeId) {
      return new NextResponse("Store id is required", { status: 400 });
    }

    const storeByUserId = await prismadb.store.findFirst({
      where: {
        id: params.storeId,
        userId
      }
    });

    if (!storeByUserId) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const foreignReference = await findForeignReference(params.storeId, { categoryId, sizeId, colorId });

    if (foreignReference) {
      return new NextResponse(foreignReference, { status: 400 });
    }

    const product = await prismadb.product.create({
      data: {
        name,
        price,
        compareAtPrice: compareAt.value,
        quantity,
        lowStockAlert: stockAlert.value,
        lowStockThreshold: stockThreshold.value,
        isFeatured,
        isArchived,
        categoryId,
        colorId,
        sizeId,
        storeId: params.storeId,
        images: {
          createMany: {
            data: toImageRows(images),
          },
        },
      },
    });
  
    return NextResponse.json(product);
  } catch (error) {
    console.log('[PRODUCTS_POST]', error);
    return new NextResponse("Internal error", { status: 500 });
  }
};

export async function GET(
  req: Request,
  { params }: { params: { storeId: string } },
) {
  try {
    const { searchParams } = new URL(req.url)
    const categoryId = searchParams.get('categoryId') || undefined;
    const colorId = searchParams.get('colorId') || undefined;
    const sizeId = searchParams.get('sizeId') || undefined;
    // "true" => featured only, "false" => not featured, anything else => no filter.
    const isFeaturedParam = searchParams.get('isFeatured');
    const isFeatured = isFeaturedParam === 'true' ? true : isFeaturedParam === 'false' ? false : undefined;
    const includeChildCategories = searchParams.get('includeChildCategories') === 'true';
    // Optional Storefront search text; missing/blank means no search filter.
    const searchTerms = parseSearchTerms(searchParams.get('q'));
    // Optional cap (positive integer, max 50); invalid values are ignored.
    const limit = parseProductsLimit(searchParams.get('limit'));

    if (!params.storeId) {
      return new NextResponse("Store id is required", { status: 400 });
    }

    // categoryId defaults to an exact match. Only when a caller explicitly
    // opts in with includeChildCategories=true does a top-level category
    // also match products in its immediate child categories. Child
    // categories and unknown/foreign ids keep exact matching either way.
    let categoryIds: string[] | undefined;

    if (categoryId && includeChildCategories) {
      const category = await prismadb.category.findFirst({
        where: {
          id: categoryId,
          storeId: params.storeId,
        },
        select: {
          parentId: true,
          children: {
            where: { storeId: params.storeId },
            select: { id: true },
          },
        },
      });

      categoryIds = category && category.parentId === null
        ? [categoryId, ...category.children.map((child) => child.id)]
        : [categoryId];
    }

    const [store, products] = await Promise.all([
      // Only the stock columns: they decide each product's `stockDisplay`.
      prismadb.store.findUnique({ where: { id: params.storeId }, select: STOCK_SETTINGS_SELECT }),
      prismadb.product.findMany({
        where: {
          storeId: params.storeId,
          categoryId: categoryIds ? { in: categoryIds } : categoryId,
          colorId,
          sizeId,
          isFeatured,
          isArchived: false,
          // Search composes with every filter above (AND). Empty => no-op.
          AND: buildProductSearchFilter(searchTerms),
        },
        include: {
          images: { orderBy: [...PRODUCT_IMAGE_ORDER] },
          category: true,
          color: true,
          size: true,
        },
        // `id` breaks createdAt ties so the order (and `limit`) is deterministic.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
      }),
    ]);

    // A missing Store has no products; the fallback only satisfies the types.
    const settings = store ?? DEFAULT_STOCK_SETTINGS;

    return NextResponse.json(products.map((product) => ({ ...product, stockDisplay: stockDisplay(product, settings) })));
  } catch (error) {
    console.log('[PRODUCTS_GET]', error);
    return new NextResponse("Internal error", { status: 500 });
  }
};
