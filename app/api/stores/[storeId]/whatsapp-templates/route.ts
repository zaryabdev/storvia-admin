import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";

import { apiError } from "@/lib/billing-plan";
import prismadb from "@/lib/prismadb";
import {
  DEFAULT_CONFIRM_TEMPLATE,
  DEFAULT_MESSAGE_TEMPLATE,
  normalizeTemplateInput,
} from "@/lib/whatsapp-message";

export const dynamic = "force-dynamic";

// Merchant-owned, authenticated. The templates are private: they are never
// part of the public Storefront Store read (GET /api/stores/:storeId).
// 401 unauthenticated, 404 unknown Store, 403 Store owned by someone else.
async function loadOwnedStore(storeId: string) {
  const { userId } = auth();
  if (!userId) return { store: null, denied: new NextResponse("Unauthenticated", { status: 401 }) };

  const store = await prismadb.store.findUnique({
    where: { id: storeId },
    select: { id: true, userId: true, whatsappConfirmTemplate: true, whatsappMessageTemplate: true },
  });
  if (!store) return { store: null, denied: apiError(404, "STORE_NOT_FOUND", "Store not found.") };
  if (store.userId !== userId) return { store: null, denied: new NextResponse("Forbidden", { status: 403 }) };

  return { store, denied: null };
}

const toBody = (store: { whatsappConfirmTemplate: string | null; whatsappMessageTemplate: string | null }) => ({
  confirmTemplate: store.whatsappConfirmTemplate,
  messageTemplate: store.whatsappMessageTemplate,
});

// GET /api/stores/:storeId/whatsapp-templates -> { confirmTemplate, messageTemplate }
// (null = the default is in use)
export async function GET(_req: Request, { params }: { params: { storeId: string } }) {
  try {
    const { store, denied } = await loadOwnedStore(params.storeId);
    if (denied || !store) return denied;

    return NextResponse.json(toBody(store));
  } catch (error) {
    console.error("[STORE_WHATSAPP_TEMPLATES_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

// PATCH /api/stores/:storeId/whatsapp-templates
// Body: { confirmTemplate?, messageTemplate? }. Omitted = unchanged. null, blank
// or text identical to the default = null (use the default). Otherwise a string
// of at most 1000 characters, stored trimmed. Unknown {placeholders} are fine.
export async function PATCH(req: Request, { params }: { params: { storeId: string } }) {
  try {
    const { store, denied } = await loadOwnedStore(params.storeId);
    if (denied || !store) return denied;

    let body: any;
    try {
      body = await req.json();
    } catch {
      return new NextResponse("Invalid request body", { status: 400 });
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return new NextResponse("Invalid request body", { status: 400 });
    }

    const data: { whatsappConfirmTemplate?: string | null; whatsappMessageTemplate?: string | null } = {};

    if (body.confirmTemplate !== undefined) {
      const result = normalizeTemplateInput(body.confirmTemplate, DEFAULT_CONFIRM_TEMPLATE);
      if ("error" in result) return new NextResponse(result.error, { status: 400 });
      data.whatsappConfirmTemplate = result.value;
    }

    if (body.messageTemplate !== undefined) {
      const result = normalizeTemplateInput(body.messageTemplate, DEFAULT_MESSAGE_TEMPLATE);
      if ("error" in result) return new NextResponse(result.error, { status: 400 });
      data.whatsappMessageTemplate = result.value;
    }

    const updated = Object.keys(data).length
      ? await prismadb.store.update({
          where: { id: store.id },
          data,
          select: { whatsappConfirmTemplate: true, whatsappMessageTemplate: true },
        })
      : store;

    return NextResponse.json(toBody(updated));
  } catch (error) {
    console.error("[STORE_WHATSAPP_TEMPLATES_PATCH]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
