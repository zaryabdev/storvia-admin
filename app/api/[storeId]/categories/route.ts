import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';

import prismadb from '@/lib/prismadb';
import { findForeignReference } from '@/lib/store-scope';
import { isCategoryIconKey } from '@/lib/category-icons';
 
export async function POST(
  req: Request,
  { params }: { params: { storeId: string } }
) {
  try {
    const { userId } = auth();

    const body = await req.json();

    const { name, billboardId, parentId, iconKey } = body;

    const normalizedBillboardId: string | null = billboardId || null;
    const normalizedParentId: string | null = parentId || null;

    if (!userId) {
      return new NextResponse("Unauthenticated", { status: 401 });
    }

    if (!name) {
      return new NextResponse("Name is required", { status: 400 });
    }

    // Optional curated icon: null / "" / omitted = no icon.
    let normalizedIconKey: string | null = null;

    if (iconKey !== undefined && iconKey !== null && iconKey !== "") {
      if (!isCategoryIconKey(iconKey)) {
        return new NextResponse("Invalid icon", { status: 400 });
      }

      normalizedIconKey = iconKey;
    }

    if (!params.storeId) {
      return new NextResponse("Store id is required", { status: 400 });
    }

    const storeByUserId = await prismadb.store.findFirst({
      where: {
        id: params.storeId,
        userId,
      }
    });

    if (!storeByUserId) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    if (normalizedParentId) {
      const parentCategory = await prismadb.category.findFirst({
        where: {
          id: normalizedParentId,
          storeId: params.storeId,
        }
      });

      if (!parentCategory) {
        return new NextResponse("Parent category not found", { status: 400 });
      }

      if (parentCategory.parentId !== null) {
        return new NextResponse("Parent category must be a top-level category", { status: 400 });
      }
    } else if (!normalizedBillboardId) {
      return new NextResponse("Billboard ID is required", { status: 400 });
    }

    const foreignReference = await findForeignReference(params.storeId, { billboardId: normalizedBillboardId });

    if (foreignReference) {
      return new NextResponse(foreignReference, { status: 400 });
    }

    const category = await prismadb.category.create({
      data: {
        name,
        billboardId: normalizedBillboardId,
        parentId: normalizedParentId,
        iconKey: normalizedIconKey,
        storeId: params.storeId,
      }
    });
  
    return NextResponse.json(category);
  } catch (error) {
    console.log('[CATEGORIES_POST]', error);
    return new NextResponse("Internal error", { status: 500 });
  }
};

export async function GET(
  req: Request,
  { params }: { params: { storeId: string } }
) {
  try {
    if (!params.storeId) {
      return new NextResponse("Store id is required", { status: 400 });
    }

    const categories = await prismadb.category.findMany({
      where: {
        storeId: params.storeId
      }
    });
  
    return NextResponse.json(categories);
  } catch (error) {
    console.log('[CATEGORIES_GET]', error);
    return new NextResponse("Internal error", { status: 500 });
  }
};
