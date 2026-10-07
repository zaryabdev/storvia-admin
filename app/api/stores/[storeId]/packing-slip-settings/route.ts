import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";

import { apiError } from "@/lib/billing-plan";
import {
  DEFAULT_SLIP_FOOTER_TEMPLATE,
  DEFAULT_SLIP_HEADER_TEMPLATE,
  isSlipPaperSize,
  normalizeSlipTemplateInput,
  type SlipPaperSizeValue,
} from "@/lib/packing-slip";
import prismadb from "@/lib/prismadb";

export const dynamic = "force-dynamic";

const SELECT = {
  slipPaperSize: true,
  slipHeaderTemplate: true,
  slipFooterTemplate: true,
} as const;

// Merchant-owned, authenticated. The settings are private: they are never
// part of the public Storefront Store read (GET /api/stores/:storeId).
// 401 unauthenticated, 404 unknown Store, 403 Store owned by someone else.
async function loadOwnedStore(storeId: string) {
  const { userId } = auth();
  if (!userId) return { store: null, denied: new NextResponse("Unauthenticated", { status: 401 }) };

  const store = await prismadb.store.findUnique({
    where: { id: storeId },
    select: { id: true, userId: true, ...SELECT },
  });
  if (!store) return { store: null, denied: apiError(404, "STORE_NOT_FOUND", "Store not found.") };
  if (store.userId !== userId) return { store: null, denied: new NextResponse("Forbidden", { status: 403 }) };

  return { store, denied: null };
}

const toBody = (store: {
  slipPaperSize: string;
  slipHeaderTemplate: string | null;
  slipFooterTemplate: string | null;
}) => ({
  paperSize: store.slipPaperSize,
  headerTemplate: store.slipHeaderTemplate,
  footerTemplate: store.slipFooterTemplate,
});

// GET /api/stores/:storeId/packing-slip-settings
// -> { paperSize, headerTemplate, footerTemplate } (template null = the default)
export async function GET(_req: Request, { params }: { params: { storeId: string } }) {
  try {
    const { store, denied } = await loadOwnedStore(params.storeId);
    if (denied || !store) return denied;

    return NextResponse.json(toBody(store));
  } catch (error) {
    console.error("[STORE_PACKING_SLIP_SETTINGS_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

// PATCH /api/stores/:storeId/packing-slip-settings
// Body: { paperSize?, headerTemplate?, footerTemplate? }. Omitted = unchanged.
// paperSize is "A5" or "A4". Templates: null, blank or text identical to the
// default = null (use the default); otherwise at most 500 characters, stored
// trimmed. Unknown {placeholders} are fine.
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

    const data: {
      slipPaperSize?: SlipPaperSizeValue;
      slipHeaderTemplate?: string | null;
      slipFooterTemplate?: string | null;
    } = {};

    if (body.paperSize !== undefined) {
      if (!isSlipPaperSize(body.paperSize)) {
        return new NextResponse("Paper size must be A5 or A4", { status: 400 });
      }
      data.slipPaperSize = body.paperSize;
    }

    if (body.headerTemplate !== undefined) {
      const result = normalizeSlipTemplateInput(body.headerTemplate, DEFAULT_SLIP_HEADER_TEMPLATE, "Header note");
      if ("error" in result) return new NextResponse(result.error, { status: 400 });
      data.slipHeaderTemplate = result.value;
    }

    if (body.footerTemplate !== undefined) {
      const result = normalizeSlipTemplateInput(body.footerTemplate, DEFAULT_SLIP_FOOTER_TEMPLATE, "Footer message");
      if ("error" in result) return new NextResponse(result.error, { status: 400 });
      data.slipFooterTemplate = result.value;
    }

    const updated = Object.keys(data).length
      ? await prismadb.store.update({ where: { id: store.id }, data, select: SELECT })
      : store;

    return NextResponse.json(toBody(updated));
  } catch (error) {
    console.error("[STORE_PACKING_SLIP_SETTINGS_PATCH]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
