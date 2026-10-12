import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { ORDER_CORS_HEADERS, createOrder, type CreateOrderPayload } from "@/lib/order-create";
import { readCheckoutPaymentMethod } from "@/lib/order-payment";

// Same CORS as POST /api/:storeId/cod, on every response.
const corsHeaders = ORDER_CORS_HEADERS;

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

// POST /api/:storeId/checkout (public): the /cod body plus a required
// paymentMethod "COD" | "BANK_TRANSFER". A body that isn't a JSON object is
// 400 "Invalid request body". Same validation, pricing, delivery,
// DRAFT status and email as /cod (lib/order-create.ts). The response is the
// /cod response plus `paymentAccounts`: the Store's accounts (public shape)
// for BANK_TRANSFER, else null.
export async function POST(
    req: Request,
    { params }: { params: { storeId: string } },
) {
    try {
        // Parse errors echo the body, so they are never logged.
        let payload: unknown;
        try {
            payload = await req.json();
        } catch {
            payload = undefined;
        }

        // Not a JSON object → "Invalid request body"; no valid method → "Choose a payment method".
        const checked = readCheckoutPaymentMethod(payload);
        if ("error" in checked) {
            return new NextResponse(checked.error, {
                status: 400,
                headers: corsHeaders,
            });
        }

        const result = await createOrder(params.storeId, payload as CreateOrderPayload, checked.paymentMethod);
        if (!result.ok) return result.response;

        return NextResponse.json(
            { ...result.body, paymentAccounts: result.paymentAccounts },
            { headers: corsHeaders },
        );
    } catch (error) {
        // Never log the body (customer details). Prisma validation errors echo
        // the query arguments, so only their name is logged.
        console.log(
            "[CHECKOUT_POST]",
            error instanceof Prisma.PrismaClientValidationError ? error.name : error,
        );
        return new NextResponse("Internal error", {
            status: 500,
            headers: corsHeaders,
        });
    }
}
