import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import { parseBillboardBody } from "@/lib/billboard";
import { findForeignReference } from "@/lib/store-scope";

export async function POST(
    req: Request,
    { params }: { params: { storeId: string } },
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

        if (!params.storeId) {
            return new NextResponse("Store id is required", { status: 400 });
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

        const foreignReference = await findForeignReference(params.storeId, {
            categoryId: fields.ctaCategoryId,
        });

        if (foreignReference) {
            return new NextResponse(foreignReference, { status: 400 });
        }

        // Photos are created in the submitted order (position = index).
        const billboard = await prismadb.billboard.create({
            data: {
                ...fields,
                storeId: params.storeId,
                images: {
                    createMany: { data: images },
                },
            },
        });

        return NextResponse.json(billboard);
    } catch (error) {
        console.log("[BILLBOARDS_POST]", error);
        return new NextResponse("Internal error", { status: 500 });
    }
}

// export async function GET(
//     req: Request,
//     { params }: { params: { storeId: string } },
// ) {
//     try {
//         if (!params.storeId) {
//             return new NextResponse("Store id is required", { status: 400 });
//         }

//         const billboards = await prismadb.billboard.findFirst({
//             where: {
//                 storeId: params.storeId,
//             },
//         });

//         return NextResponse.json(billboards);
//     } catch (error) {
//         console.log("[BILLBOARDS_GET]", error);
//         return new NextResponse("Internal error", { status: 500 });
//     }
// }
