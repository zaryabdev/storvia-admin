import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";

import prismadb from "@/lib/prismadb";
import { productInUseMessage, inUseResponse, foreignKeyConflictResponse } from "@/lib/delete-guards";
import { existsInStore, findForeignReference } from "@/lib/store-scope";
import { parseCompareAtPrice } from "@/lib/compare-at-price";
import { PRODUCT_IMAGE_ORDER, toImageRows, validateProductImages } from "@/lib/product-images";
import { DEFAULT_STOCK_SETTINGS, STOCK_SETTINGS_SELECT, parseLowStockAlert, parseProductLowStockThreshold, stockDisplay } from "@/lib/stock";

export async function GET(
  req: Request,
  { params }: { params: { productId: string, storeId: string } }
) {
  try {
    if (!params.productId) {
      return new NextResponse("Product id is required", { status: 400 });
    }

    if (!params.storeId) {
      return new NextResponse("Store id is required", { status: 400 });
    }

    // Public Storefront read: must be Store-scoped and never expose an
    // archived Product (same rules as the list route). `findFirst` because
    // Prisma 4.16 `findUnique` cannot filter on non-unique fields. A miss
    // (unknown / other Store / archived) keeps returning HTTP 200 with a
    // `null` body — Storefront's getProduct() relies on that contract.
    const [store, product] = await Promise.all([
      // Only the stock columns: they decide the product's `stockDisplay`.
      prismadb.store.findUnique({ where: { id: params.storeId }, select: STOCK_SETTINGS_SELECT }),
      prismadb.product.findFirst({
        where: {
          id: params.productId,
          storeId: params.storeId,
          isArchived: false,
        },
        include: {
          images: { orderBy: [...PRODUCT_IMAGE_ORDER] },
          category: true,
          size: true,
          color: true,
        }
      }),
    ]);

    if (!product) {
      return NextResponse.json(null);
    }

    return NextResponse.json({ ...product, stockDisplay: stockDisplay(product, store ?? DEFAULT_STOCK_SETTINGS) });
  } catch (error) {
    console.log('[PRODUCT_GET]', error);
    return new NextResponse("Internal error", { status: 500 });
  }
};

export async function DELETE(
  req: Request,
  { params }: { params: { productId: string, storeId: string } }
) {
  try {
    const { userId } = auth();

    if (!userId) {
      return new NextResponse("Unauthenticated", { status: 401 });
    }

    if (!params.productId) {
      return new NextResponse("Product id is required", { status: 400 });
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

    if (!(await existsInStore("product", params.productId, params.storeId))) {
      return new NextResponse("Product not found", { status: 404 });
    }

    const inUse = await productInUseMessage(params.productId);

    if (inUse) {
      return inUseResponse(inUse);
    }

    const product = await prismadb.product.delete({
      where: {
        id: params.productId
      },
    });
  
    return NextResponse.json(product);
  } catch (error) {
    console.log('[PRODUCT_DELETE]', error);
    return foreignKeyConflictResponse(error) ?? new NextResponse("Internal error", { status: 500 });
  }
};


export async function PATCH(
  req: Request,
  { params }: { params: { productId: string, storeId: string } }
) {
  try {
    const { userId } = auth();

    const body = await req.json();

    const { name, price, compareAtPrice, quantity, lowStockAlert, lowStockThreshold, categoryId, images, colorId, sizeId, isFeatured, isArchived } = body;

    if (!userId) {
      return new NextResponse("Unauthenticated", { status: 401 });
    }

    if (!params.productId) {
      return new NextResponse("Product id is required", { status: 400 });
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

    // Missing = unchanged; null / "" = cleared; otherwise a decimal above price.
    const compareAt = parseCompareAtPrice(compareAtPrice, price);

    if ("error" in compareAt) {
      return new NextResponse(compareAt.error, { status: 400 });
    }

    if (typeof quantity !== 'number' || quantity < 0) {
      return new NextResponse("A valid quantity is required", { status: 400 });
    }

    // Missing = unchanged; otherwise a boolean.
    const stockAlert = parseLowStockAlert(lowStockAlert);

    if ("error" in stockAlert) {
      return new NextResponse(stockAlert.error, { status: 400 });
    }

    // Missing = unchanged; null / "" = cleared (Store default); otherwise 1–1000.
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

    const storeByUserId = await prismadb.store.findFirst({
      where: {
        id: params.storeId,
        userId
      }
    });

    if (!storeByUserId) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Ownership is confirmed before any write, including the image reset.
    if (!(await existsInStore("product", params.productId, params.storeId))) {
      return new NextResponse("Product not found", { status: 404 });
    }

    const foreignReference = await findForeignReference(params.storeId, { categoryId, sizeId, colorId });

    if (foreignReference) {
      return new NextResponse(foreignReference, { status: 400 });
    }

    // One transaction: if any step fails, the old images and fields stay.
    // Ownership and foreign references were verified above.
    const [product] = await prismadb.$transaction([
      prismadb.product.update({
        where: {
          id: params.productId
        },
        data: {
          name,
          price,
          compareAtPrice: compareAt.value,
          quantity,
          lowStockAlert: stockAlert.value,
          lowStockThreshold: stockThreshold.value,
          categoryId,
          colorId,
          sizeId,
          isFeatured,
          isArchived,
        },
      }),
      prismadb.image.deleteMany({
        where: { productId: params.productId },
      }),
      prismadb.image.createMany({
        data: toImageRows(images).map((image) => ({ ...image, productId: params.productId })),
      }),
    ]);

    return NextResponse.json(product);
  } catch (error) {
    console.log('[PRODUCT_PATCH]', error);
    return new NextResponse("Internal error", { status: 500 });
  }
};
