import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";

import prismadb from "@/lib/prismadb";
import { colorInUseMessage, inUseResponse, foreignKeyConflictResponse } from "@/lib/delete-guards";
import { existsInStore } from "@/lib/store-scope";

export async function GET(
  req: Request,
  { params }: { params: { colorId: string, storeId: string } }
) {
  try {
    if (!params.colorId) {
      return new NextResponse("Color id is required", { status: 400 });
    }

    if (!params.storeId) {
      return new NextResponse("Store id is required", { status: 400 });
    }

    // Public read: Store-scoped like the product and category by-id reads.
    // A miss (unknown / other Store) returns HTTP 200 with a `null` body.
    const color = await prismadb.color.findFirst({
      where: {
        id: params.colorId,
        storeId: params.storeId,
      }
    });
  
    return NextResponse.json(color);
  } catch (error) {
    console.log('[COLOR_GET]', error);
    return new NextResponse("Internal error", { status: 500 });
  }
};

export async function DELETE(
  req: Request,
  { params }: { params: { colorId: string, storeId: string } }
) {
  try {
    const { userId } = auth();

    if (!userId) {
      return new NextResponse("Unauthenticated", { status: 401 });
    }

    if (!params.colorId) {
      return new NextResponse("Color id is required", { status: 400 });
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

    if (!(await existsInStore("color", params.colorId, params.storeId))) {
      return new NextResponse("Color not found", { status: 404 });
    }

    const inUse = await colorInUseMessage(params.colorId);

    if (inUse) {
      return inUseResponse(inUse);
    }

    const color = await prismadb.color.delete({
      where: {
        id: params.colorId
      }
    });
  
    return NextResponse.json(color);
  } catch (error) {
    console.log('[COLOR_DELETE]', error);
    return foreignKeyConflictResponse(error) ?? new NextResponse("Internal error", { status: 500 });
  }
};


export async function PATCH(
  req: Request,
  { params }: { params: { colorId: string, storeId: string } }
) {
  try {
    const { userId } = auth();

    const body = await req.json();

    const { name, value } = body;

    if (!userId) {
      return new NextResponse("Unauthenticated", { status: 401 });
    }

    if (!name) {
      return new NextResponse("Name is required", { status: 400 });
    }

    if (!value) {
      return new NextResponse("Value is required", { status: 400 });
    }


    if (!params.colorId) {
      return new NextResponse("Color id is required", { status: 400 });
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

    if (!(await existsInStore("color", params.colorId, params.storeId))) {
      return new NextResponse("Color not found", { status: 404 });
    }

    const color = await prismadb.color.update({
      where: {
        id: params.colorId
      },
      data: {
        name,
        value
      }
    });
  
    return NextResponse.json(color);
  } catch (error) {
    console.log('[COLOR_PATCH]', error);
    return new NextResponse("Internal error", { status: 500 });
  }
};
