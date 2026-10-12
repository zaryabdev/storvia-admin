import { NextResponse } from "next/server";

import { ORDER_CORS_HEADERS, createOrder, type CreateOrderPayload } from "@/lib/order-create";

// POST /api/:storeId/cod: always a COD order. Kept unchanged for older
// Storefronts; POST /api/:storeId/checkout is the path with a payment method.
// The order logic lives in lib/order-create.ts (shared with /checkout).
const corsHeaders = ORDER_CORS_HEADERS;

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(
    req: Request,
    { params }: { params: { storeId: string } },
) {
    try {
        const payload = (await req.json()) as CreateOrderPayload;

        const result = await createOrder(params.storeId, payload, "COD");
        if (!result.ok) return result.response;

        return NextResponse.json(result.body, { headers: corsHeaders });
    } catch (error) {
        console.log("[COD_POST]", error);
        return new NextResponse("Internal error", {
            status: 500,
            headers: corsHeaders,
        });
    }
}
