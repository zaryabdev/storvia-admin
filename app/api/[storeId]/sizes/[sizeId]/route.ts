import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import { sizeInUseMessage, inUseResponse, foreignKeyConflictResponse } from "@/lib/delete-guards";
import { existsInStore } from "@/lib/store-scope";
import { auth } from "@clerk/nextjs";

export async function GET(
  req: Request,
  { params }: { params: { sizeId: string, storeId: string } }
) {
  try {
    if (!params.sizeId) {
      return new NextResponse("Size id is required", { status: 400 });
    }

    if (!params.storeId) {
      return new NextResponse("Store id is required", { status: 400 });
    }

    // Public read: Store-scoped like the product and category by-id reads.
    // A miss (unknown / other Store) returns HTTP 200 with a `null` body.
    const size = await prismadb.size.findFirst({
      where: {
        id: params.sizeId,
        storeId: params.storeId,
      }
    });
  
    return NextResponse.json(size);
  } catch (error) {
    console.log('[SIZE_GET]', error);
    return new NextResponse("Internal error", { status: 500 });
  }
};

export async function DELETE(
  req: Request,
  { params }: { params: { sizeId: string, storeId: string } }
) {
  try {
    const { userId } = auth();

    if (!userId) {
      return new NextResponse("Unauthenticated", { status: 403 });
    }

    if (!params.sizeId) {
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

    if (!(await existsInStore("size", params.sizeId, params.storeId))) {
      return new NextResponse("Size not found", { status: 404 });
    }

    const inUse = await sizeInUseMessage(params.sizeId);

    if (inUse) {
      return inUseResponse(inUse);
    }

    const size = await prismadb.size.delete({
      where: {
        id: params.sizeId
      }
    });
  
    return NextResponse.json(size);
  } catch (error) {
    console.log('[SIZE_DELETE]', error);
    return foreignKeyConflictResponse(error) ?? new NextResponse("Internal error", { status: 500 });
  }
};


export async function PATCH(
  req: Request,
  { params }: { params: { sizeId: string, storeId: string } }
) {
  try {
    const { userId } = auth();

    const body = await req.json();

    const { name, value } = body;

    if (!userId) {
      return new NextResponse("Unauthenticated", { status: 403 });
    }

    if (!name) {
      return new NextResponse("Name is required", { status: 400 });
    }

    if (!value) {
      return new NextResponse("Value is required", { status: 400 });
    }


    if (!params.sizeId) {
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

    if (!(await existsInStore("size", params.sizeId, params.storeId))) {
      return new NextResponse("Size not found", { status: 404 });
    }

    const size = await prismadb.size.update({
      where: {
        id: params.sizeId
      },
      data: {
        name,
        value
      }
    });
  
    return NextResponse.json(size);
  } catch (error) {
    console.log('[SIZE_PATCH]', error);
    return new NextResponse("Internal error", { status: 500 });
  }
};
