import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import { storeInUseMessage, inUseResponse, foreignKeyConflictResponse } from "@/lib/delete-guards";

export async function PATCH(
    req: Request,
    { params }: { params: { storeId: string } },
) {
    try {
        const { userId } = auth();
        const body = await req.json();

        const { name, logoUrl, faviconUrl } = body;

        if (!userId) {
            return new NextResponse("Unauthenticated", { status: 403 });
        }

        if (!name) {
            return new NextResponse("Name is required", { status: 400 });
        }

        if (!params.storeId) {
            return new NextResponse("Store id is required", { status: 400 });
        }

        const storeByUserId = await prismadb.store.findFirst({
            where: { id: params.storeId, userId },
        });

        if (!storeByUserId) {
            return new NextResponse("Unauthorized", { status: 405 });
        }

        const normalizedLogoUrl =
            typeof logoUrl === "string" && logoUrl.trim() !== ""
                ? logoUrl.trim()
                : null;

        const normalizedFaviconUrl =
            typeof faviconUrl === "string" && faviconUrl.trim() !== ""
                ? faviconUrl.trim()
                : null;

        const store = await prismadb.store.update({
            where: { id: params.storeId },
            data: { name, logoUrl: normalizedLogoUrl, faviconUrl: normalizedFaviconUrl },
        });

        return NextResponse.json(store);
    } catch (error) {
        console.log("[STORE_PATCH]", error);
        return new NextResponse("Internal error", { status: 500 });
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: { storeId: string } },
) {
    try {
        const { userId } = auth();

        if (!userId) {
            return new NextResponse("Unauthenticated", { status: 403 });
        }

        if (!params.storeId) {
            return new NextResponse("Store id is required", { status: 400 });
        }

        const existingStore = await prismadb.store.findUnique({
            where: { id: params.storeId },
            select: { userId: true },
        });

        if (!existingStore) {
            return new NextResponse("Not found", { status: 404 });
        }

        // Same response the PATCH gives a non-owner.
        if (existingStore.userId !== userId) {
            return new NextResponse("Unauthorized", { status: 405 });
        }

        const inUse = await storeInUseMessage(params.storeId);

        if (inUse) {
            return inUseResponse(inUse);
        }

        const store = await prismadb.store.deleteMany({
            where: {
                id: params.storeId,
                userId,
            },
        });

        return NextResponse.json(store);
    } catch (error) {
        console.log("[STORE_DELETE]", error);
        return foreignKeyConflictResponse(error) ?? new NextResponse("Internal error", { status: 500 });
    }
}

export async function GET(
    _req: Request,
    { params }: { params: { storeId: string } },
) {
    try {
        if (!params.storeId) {
            return new NextResponse("Store id is required", { status: 400 });
        }

        const store = await prismadb.store.findUnique({
            where: { id: params.storeId },
            select: {
                id: true,
                name: true,
                logoUrl: true,
                faviconUrl: true,
            },
        });

        if (!store) {
            return new NextResponse("Not found", { status: 404 });
        }

        return NextResponse.json(store);
    } catch (error) {
        console.log("[PUBLIC_STORE_GET]", error);
        return new NextResponse("Internal error", { status: 500 });
    }
}
