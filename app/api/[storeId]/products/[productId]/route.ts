import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";

import prismadb from "@/lib/prismadb";
import { productInUseMessage, inUseResponse, foreignKeyConflictResponse } from "@/lib/delete-guards";
import { existsInStore, findForeignReference } from "@/lib/store-scope";
import { PRODUCT_IMAGE_ORDER, toImageRows, validateProductImages } from "@/lib/product-images";

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
    const product = await prismadb.product.findFirst({
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
    });
  
    return NextResponse.json(product);
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
      return new NextResponse("Unauthenticated", { status: 403 });
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
      return new NextResponse("Unauthorized", { status: 405 });
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

    const { name, price, quantity, categoryId, images, colorId, sizeId, isFeatured, isArchived } = body;

    if (!userId) {
      return new NextResponse("Unauthenticated", { status: 403 });
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

    if (typeof quantity !== 'number' || quantity < 0) {
      return new NextResponse("A valid quantity is required", { status: 400 });
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
      return new NextResponse("Unauthorized", { status: 405 });
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
          quantity,
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
