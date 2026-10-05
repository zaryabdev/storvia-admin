import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';

import prismadb from '@/lib/prismadb';
import { buildProductSearchFilter, parseSearchTerms } from '@/lib/product-search';
import { findForeignReference } from '@/lib/store-scope';

export async function POST(
  req: Request,
  { params }: { params: { storeId: string } }
) {
  try {
    const { userId } = auth();

    const body = await req.json();

    const { name, price, quantity, categoryId, colorId, sizeId, images, isFeatured, isArchived } = body;

    if (!userId) {
      return new NextResponse("Unauthenticated", { status: 403 });
    }

    if (!name) {
      return new NextResponse("Name is required", { status: 400 });
    }

    if (!images || !images.length) {
      return new NextResponse("Images are required", { status: 400 });
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
      return new NextResponse("Unauthorized", { status: 405 });
    }

    const foreignReference = await findForeignReference(params.storeId, { categoryId, sizeId, colorId });

    if (foreignReference) {
      return new NextResponse(foreignReference, { status: 400 });
    }

    const product = await prismadb.product.create({
      data: {
        name,
        price,
        quantity,
        isFeatured,
        isArchived,
        categoryId,
        colorId,
        sizeId,
        storeId: params.storeId,
        images: {
          createMany: {
            data: [
              ...images.map((image: { url: string }) => image),
            ],
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

    const products = await prismadb.product.findMany({
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
        images: true,
        category: true,
        color: true,
        size: true,
      },
      orderBy: {
        createdAt: 'desc',
      }
    });
  
    return NextResponse.json(products);
  } catch (error) {
    console.log('[PRODUCTS_GET]', error);
    return new NextResponse("Internal error", { status: 500 });
  }
};
