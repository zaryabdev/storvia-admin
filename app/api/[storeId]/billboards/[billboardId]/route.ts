import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import { billboardInUseMessage, inUseResponse, foreignKeyConflictResponse } from "@/lib/delete-guards";
import { existsInStore, findForeignReference } from "@/lib/store-scope";
import { BILLBOARD_INCLUDE, parseBillboardBody } from "@/lib/billboard";

export async function GET(
    req: Request,
    { params }: { params: { billboardId: string; storeId: string } },
) {
    try {
        if (!params.storeId) {
            return new NextResponse("Store id is required", { status: 400 });
        }

        if (!params.billboardId) {
            return new NextResponse("Billboard id is required", {
                status: 400,
            });
        }

        const billboard = await prismadb.billboard.findFirst({
            where: {
                id: params.billboardId,
                storeId: params.storeId,
            },
            include: BILLBOARD_INCLUDE,
        });

        if (!billboard) {
            return new NextResponse("Not found", { status: 404 });
        }

        return NextResponse.json(billboard);
    } catch (error) {
        console.log("[BILLBOARD_GET]", error);
        return new NextResponse("Internal error", { status: 500 });
    }
}

// export async function GET(
//     req: Request,
//     { params }: { params: { billboardId: string } },
// ) {
//     try {
//         if (!params.billboardId) {
//             return new NextResponse("Billboard id is required", {
//                 status: 400,
//             });
//         }

//         const billboard = await prismadb.billboard.findFirst({
//             where: {
//                 storeId: params.billboardId,
//             },
//         });

//         return NextResponse.json(billboard);
//     } catch (error) {
//         console.log("[BILLBOARD_GET]", error);
//         return new NextResponse("Internal error", { status: 500 });
//     }
// }

export async function DELETE(
    req: Request,
    { params }: { params: { billboardId: string; storeId: string } },
) {
    try {
        const { userId } = auth();

        if (!userId) {
            return new NextResponse("Unauthenticated", { status: 401 });
        }

        if (!params.billboardId) {
            return new NextResponse("Billboard id is required", {
                status: 400,
            });
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

        if (!(await existsInStore("billboard", params.billboardId, params.storeId))) {
            return new NextResponse("Billboard not found", { status: 404 });
        }

        const inUse = await billboardInUseMessage(params.billboardId);

        if (inUse) {
          return inUseResponse(inUse);
        }

        const billboard = await prismadb.billboard.delete({
            where: {
                id: params.billboardId,
            },
        });

        return NextResponse.json(billboard);
    } catch (error) {
        console.log("[BILLBOARD_DELETE]", error);
        return foreignKeyConflictResponse(error) ?? new NextResponse("Internal error", { status: 500 });
    }
}

export async function PATCH(
    req: Request,
    { params }: { params: { billboardId: string; storeId: string } },
) {
    try {
        const { userId } = auth();

        const body = await req.json();

        if (!userId) {
            return new NextResponse("Unauthenticated", { status: 401 });
        }

        const parsed = parseBillboardBody(body);

        if ("error" in parsed) {
            return new NextResponse(parsed.error, { status: 400 });
        }

        const { images, ...fields } = parsed.fields;

        if (!params.billboardId) {
            return new NextResponse("Billboard id is required", {
                status: 400,
            });
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

        if (!(await existsInStore("billboard", params.billboardId, params.storeId))) {
            return new NextResponse("Billboard not found", { status: 404 });
        }

        const foreignReference = await findForeignReference(params.storeId, {
            categoryId: fields.ctaCategoryId,
        });

        if (foreignReference) {
            return new NextResponse(foreignReference, { status: 400 });
        }

        // One transaction: if any step fails, the old photos and fields stay.
        // `imageUrl` (the cover) is the first photo.
        const [billboard] = await prismadb.$transaction([
            prismadb.billboard.update({
                where: {
                    id: params.billboardId,
                },
                data: fields,
            }),
            prismadb.billboardImage.deleteMany({
                where: { billboardId: params.billboardId },
            }),
            prismadb.billboardImage.createMany({
                data: images.map((image) => ({ ...image, billboardId: params.billboardId })),
            }),
        ]);

        return NextResponse.json(billboard);
    } catch (error) {
        console.log("[BILLBOARD_PATCH]", error);
        return new NextResponse("Internal error", { status: 500 });
    }
}
