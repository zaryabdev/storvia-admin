import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import { BILLBOARD_INCLUDE } from "@/lib/billboard";

export async function GET(
    req: Request,
    { params }: { params: { storeId: string } },
) {
    try {
        if (!params.storeId) {
            return new NextResponse("Store id is required", { status: 400 });
        }

        const store = await prismadb.store.findUnique({
            where: {
                id: params.storeId,
            },
            include: {
                homepageBillboard: { include: BILLBOARD_INCLUDE },
            },
        });

        if (!store) {
            return new NextResponse("Not found", { status: 404 });
        }

        return NextResponse.json(store.homepageBillboard);
    } catch (error) {
        console.log("[HOMEPAGE_BILLBOARD_GET]", error);
        return new NextResponse("Internal error", { status: 500 });
    }
}

export async function PATCH(
    req: Request,
    { params }: { params: { storeId: string } },
) {
    try {
        const { userId } = auth();

        const body = await req.json();

        const { billboardId } = body;

        if (!userId) {
            return new NextResponse("Unauthenticated", { status: 401 });
        }

        if (!params.storeId) {
            return new NextResponse("Store id is required", { status: 400 });
        }

        if (billboardId !== null && typeof billboardId !== "string") {
            return new NextResponse("Billboard id is required", { status: 400 });
        }

        const storeByUserId = await prismadb.store.findFirst({
            where: {
                id: params.storeId,
                userId,
            },
        });

        if (!storeByUserId) {
            return new NextResponse("Forbidden", { status: 403 });
        }

        if (billboardId === null) {
            const store = await prismadb.store.update({
                where: {
                    id: params.storeId,
                },
                data: {
                    homepageBillboardId: null,
                },
            });

            return NextResponse.json(store);
        }

        const billboard = await prismadb.billboard.findFirst({
            where: {
                id: billboardId,
                storeId: params.storeId,
            },
        });

        if (!billboard) {
            return new NextResponse("Billboard not found", { status: 404 });
        }

        const store = await prismadb.store.update({
            where: {
                id: params.storeId,
            },
            data: {
                homepageBillboardId: billboardId,
            },
        });

        return NextResponse.json(store);
    } catch (error) {
        console.log("[HOMEPAGE_BILLBOARD_PATCH]", error);
        return new NextResponse("Internal error", { status: 500 });
    }
}
