import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import {
  FAQ_ITEM_ORDER,
  FAQ_ITEM_SELECT,
  STORE_PAGE_SLUGS,
  pageKindFromSlug,
  publicFaqItems,
  publicPageBody,
} from "@/lib/store-pages";

// Settings changes show on the next Storefront request: never cached.
export const dynamic = "force-dynamic";

// Same CORS as POST /api/:storeId/cod, on every response.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET /api/:storeId/pages/:kind (public), kind = about | contact | returns | faq.
//   -> { kind: "about", body } or { kind: "faq", items: [{ question, answer }] }
// only while the page is live (enabled with content; stored values are
// re-checked with the lib/store-pages.ts rules). An unknown Store, an unknown
// kind or a page that isn't live → 200 null.
export async function GET(_req: Request, { params }: { params: { storeId: string; kind: string } }) {
  try {
    const kind = pageKindFromSlug(params.kind);
    if (!kind) return NextResponse.json(null, { headers: corsHeaders });

    const page = await prismadb.storePage.findUnique({
      where: { storeId_kind: { storeId: params.storeId, kind } },
      select: { enabled: true, body: true },
    });
    if (!page?.enabled) return NextResponse.json(null, { headers: corsHeaders });

    if (kind === "FAQ") {
      const rows = await prismadb.storeFaqItem.findMany({
        where: { storeId: params.storeId },
        orderBy: FAQ_ITEM_ORDER,
        select: FAQ_ITEM_SELECT,
      });
      const items = publicFaqItems(rows);

      return NextResponse.json(items.length ? { kind: STORE_PAGE_SLUGS.FAQ, items } : null, {
        headers: corsHeaders,
      });
    }

    const body = publicPageBody(kind, page.body);

    return NextResponse.json(body ? { kind: STORE_PAGE_SLUGS[kind], body } : null, { headers: corsHeaders });
  } catch (error) {
    console.log("[PUBLIC_STORE_PAGE_GET]", error);
    return new NextResponse("Internal error", { status: 500, headers: corsHeaders });
  }
}
