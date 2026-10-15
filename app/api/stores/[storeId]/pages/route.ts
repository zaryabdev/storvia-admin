import { auth } from "@clerk/nextjs";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { apiError } from "@/lib/billing-plan";
import prismadb from "@/lib/prismadb";
import {
  FAQ_ITEM_ORDER,
  FAQ_ITEM_SELECT,
  STORE_PAGE_SELECT,
  parseStorePagePatch,
  toStorePagesSettings,
} from "@/lib/store-pages";

export const dynamic = "force-dynamic";

const PAGES_SELECT = {
  pages: { select: STORE_PAGE_SELECT },
  faqItems: { orderBy: FAQ_ITEM_ORDER, select: FAQ_ITEM_SELECT },
} as const;

// Merchant-owned, authenticated. The public routes expose a page only while it
// is live (enabled with content).
// 401 unauthenticated, 404 unknown Store, 403 Store owned by someone else.
async function loadOwnedStore(storeId: string) {
  const { userId } = auth();
  if (!userId) return { store: null, denied: new NextResponse("Unauthenticated", { status: 401 }) };

  const store = await prismadb.store.findUnique({
    where: { id: storeId },
    select: { id: true, userId: true },
  });
  if (!store) return { store: null, denied: apiError(404, "STORE_NOT_FOUND", "Store not found.") };
  if (store.userId !== userId) return { store: null, denied: new NextResponse("Forbidden", { status: 403 }) };

  return { store, denied: null };
}

async function readPages(storeId: string) {
  const store = await prismadb.store.findUniqueOrThrow({ where: { id: storeId }, select: PAGES_SELECT });
  return toStorePagesSettings(store.pages, store.faqItems);
}

// GET /api/stores/:storeId/pages
//   -> { pages: [{ kind, enabled, body }] (ABOUT, CONTACT, RETURNS, FAQ), faqItems: [{ question, answer }] }
export async function GET(_req: Request, { params }: { params: { storeId: string } }) {
  try {
    const { store, denied } = await loadOwnedStore(params.storeId);
    if (denied || !store) return denied;

    return NextResponse.json(await readPages(store.id));
  } catch (error) {
    console.error("[STORE_PAGES_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

// PATCH /api/stores/:storeId/pages
// Body: { kind, enabled, body } or { kind: "FAQ", enabled, items: [{ question, answer }] }.
// One page per request, replaced as sent. Rules in lib/store-pages.ts
// (parseStorePagePatch). The FAQ row and all its questions are replaced in one
// transaction (position = index). Returns the GET shape.
export async function PATCH(req: Request, { params }: { params: { storeId: string } }) {
  try {
    const { store, denied } = await loadOwnedStore(params.storeId);
    if (denied || !store) return denied;

    // Parse errors echo the body, so they are never logged.
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new NextResponse("Invalid request body", { status: 400 });
    }

    const result = parseStorePagePatch(body);
    if ("error" in result) return new NextResponse(result.error, { status: 400 });

    const page = result.value;
    const where = { storeId_kind: { storeId: store.id, kind: page.kind } };

    if (page.kind === "FAQ") {
      await prismadb.$transaction([
        prismadb.storePage.upsert({
          where,
          create: { storeId: store.id, kind: page.kind, enabled: page.enabled, body: null },
          update: { enabled: page.enabled, body: null },
        }),
        prismadb.storeFaqItem.deleteMany({ where: { storeId: store.id } }),
        prismadb.storeFaqItem.createMany({
          data: page.items.map((item, position) => ({ storeId: store.id, position, ...item })),
        }),
      ]);
    } else {
      await prismadb.storePage.upsert({
        where,
        create: { storeId: store.id, kind: page.kind, enabled: page.enabled, body: page.body },
        update: { enabled: page.enabled, body: page.body },
      });
    }

    return NextResponse.json(await readPages(store.id));
  } catch (error) {
    // Never log the body. Prisma validation errors echo the query arguments
    // (the page text), so only their name is logged.
    console.error(
      "[STORE_PAGES_PATCH]",
      error instanceof Prisma.PrismaClientValidationError ? error.name : error,
    );
    return new NextResponse("Internal error", { status: 500 });
  }
}
