import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";

import prismadb from "@/lib/prismadb";
import { findForeignReference } from "@/lib/store-scope";
import { isCategoryIconKey } from "@/lib/category-icons";

export async function GET(
  req: Request,
  { params }: { params: { categoryId: string, storeId: string } }
) {
  try {
    if (!params.categoryId) {
      return new NextResponse("Category id is required", { status: 400 });
    }

    if (!params.storeId) {
      return new NextResponse("Store id is required", { status: 400 });
    }

    // Public Storefront read: must be Store-scoped. `findFirst` because
    // Prisma `findUnique` cannot filter on non-unique fields. A miss
    // (unknown / other Store) keeps returning HTTP 200 with a `null` body —
    // Storefront's getCategory() relies on that contract.
    const category = await prismadb.category.findFirst({
      where: {
        id: params.categoryId,
        storeId: params.storeId,
      },
      include: {
        billboard: true
      }
    });
  
    return NextResponse.json(category);
  } catch (error) {
    console.log('[CATEGORY_GET]', error);
    return new NextResponse("Internal error", { status: 500 });
  }
};

export async function DELETE(
  req: Request,
  { params }: { params: { categoryId: string, storeId: string } }
) {
  try {
    const { userId } = auth();

    if (!userId) {
      return new NextResponse("Unauthenticated", { status: 403 });
    }

    if (!params.categoryId) {
      return new NextResponse("Category id is required", { status: 400 });
    }

    const storeByUserId = await prismadb.store.findFirst({
      where: {
        id: params.storeId,
        userId,
      }
    });

    if (!storeByUserId) {
      return new NextResponse("Unauthorized", { status: 405 });
    }

    const existingCategory = await prismadb.category.findFirst({
      where: {
        id: params.categoryId,
        storeId: params.storeId,
      },
      include: {
        children: true,
      }
    });

    if (!existingCategory) {
      return new NextResponse("Category not found", { status: 404 });
    }

    if (existingCategory.children.length > 0) {
      return new NextResponse("Remove or reassign this category's child categories before deleting it", { status: 400 });
    }

    const category = await prismadb.category.delete({
      where: {
        id: params.categoryId,
      }
    });
  
    return NextResponse.json(category);
  } catch (error) {
    console.log('[CATEGORY_DELETE]', error);
    return new NextResponse("Internal error", { status: 500 });
  }
};


export async function PATCH(
  req: Request,
  { params }: { params: { categoryId: string, storeId: string } }
) {
  try {   
    const { userId } = auth();

    const body = await req.json();

    const { name, billboardId, parentId, iconKey } = body;

    const normalizedBillboardId: string | null = billboardId || null;
    const normalizedParentId: string | null = parentId || null;

    if (!userId) {
      return new NextResponse("Unauthenticated", { status: 403 });
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

    if (!params.categoryId) {
      return new NextResponse("Category id is required", { status: 400 });
    }

    const storeByUserId = await prismadb.store.findFirst({
      where: {
        id: params.storeId,
        userId,
      }
    });

    if (!storeByUserId) {
      return new NextResponse("Unauthorized", { status: 405 });
    }

    const existingCategory = await prismadb.category.findFirst({
      where: {
        id: params.categoryId,
        storeId: params.storeId,
      },
      include: {
        children: true,
      }
    });

    if (!existingCategory) {
      return new NextResponse("Category not found", { status: 404 });
    }

    if (normalizedParentId) {
      if (normalizedParentId === params.categoryId) {
        return new NextResponse("A category cannot be its own parent", { status: 400 });
      }

      if (existingCategory.children.length > 0) {
        return new NextResponse("A category with child categories cannot be moved under another category", { status: 400 });
      }

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

    const category = await prismadb.category.update({
      where: {
        id: params.categoryId,
      },
      data: {
        name,
        billboardId: normalizedBillboardId,
        parentId: normalizedParentId,
        iconKey: normalizedIconKey,
      }
    });
  
    return NextResponse.json(category);
  } catch (error) {
    console.log('[CATEGORY_PATCH]', error);
    return new NextResponse("Internal error", { status: 500 });
  }
};
