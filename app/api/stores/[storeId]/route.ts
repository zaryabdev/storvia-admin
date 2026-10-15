import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";

import { publicPixelIds } from "@/lib/integrations";
import { isBankTransferAvailable } from "@/lib/payment-accounts";
import prismadb from "@/lib/prismadb";
import { STOREFRONT_SETTINGS_SELECT, publicAnnouncement, publicSocialLinks } from "@/lib/storefront-settings";
import { publicPageFlags } from "@/lib/store-pages";
import { storeInUseMessage, inUseResponse, foreignKeyConflictResponse } from "@/lib/delete-guards";

// The public GET reflects Settings changes immediately (announcement, social
// links, pages, pixels, bank transfer): never cached.
export const dynamic = "force-dynamic";

const MAX_URL_LENGTH = 2048;

type UrlField = { present: boolean; value: string | null; valid: boolean };

// Omitted (undefined) = leave unchanged. null or "" (after trim) = clear.
// Otherwise a string holding an https: URL of at most 2048 characters.
function readUrlField(raw: unknown): UrlField {
    if (raw === undefined) {
        return { present: false, value: null, valid: true };
    }

    if (raw === null) {
        return { present: true, value: null, valid: true };
    }

    if (typeof raw !== "string") {
        return { present: true, value: null, valid: false };
    }

    const trimmed = raw.trim();

    if (trimmed === "") {
        return { present: true, value: null, valid: true };
    }

    if (trimmed.length > MAX_URL_LENGTH) {
        return { present: true, value: null, valid: false };
    }

    try {
        if (new URL(trimmed).protocol !== "https:") {
            return { present: true, value: null, valid: false };
        }
    } catch {
        return { present: true, value: null, valid: false };
    }

    return { present: true, value: trimmed, valid: true };
}

export async function PATCH(
    req: Request,
    { params }: { params: { storeId: string } },
) {
    try {
        const { userId } = auth();
        const body = await req.json();

        const { name, logoUrl, faviconUrl } = body;

        if (!userId) {
            return new NextResponse("Unauthenticated", { status: 401 });
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
            return new NextResponse("Forbidden", { status: 403 });
        }

        const logo = readUrlField(logoUrl);
        const favicon = readUrlField(faviconUrl);

        if (!logo.valid) {
            return new NextResponse("Invalid logo URL", { status: 400 });
        }

        if (!favicon.valid) {
            return new NextResponse("Invalid favicon URL", { status: 400 });
        }

        const store = await prismadb.store.update({
            where: { id: params.storeId },
            data: {
                name,
                ...(logo.present && { logoUrl: logo.value }),
                ...(favicon.present && { faviconUrl: favicon.value }),
            },
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
            return new NextResponse("Unauthenticated", { status: 401 });
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
            return new NextResponse("Forbidden", { status: 403 });
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

// The public `pages` flags, in their own query so a failure here never fails
// the Store GET: on error every flag is false. Only the kinds of the enabled
// pages with content are read, never the texts.
async function loadPageFlags(storeId: string) {
    try {
        const [live, faqItemCount] = await Promise.all([
            prismadb.storePage.findMany({
                where: { storeId, enabled: true, OR: [{ kind: "FAQ" }, { body: { not: null } }] },
                select: { kind: true },
            }),
            prismadb.storeFaqItem.count({ where: { storeId } }),
        ]);
        return publicPageFlags(live.map((page) => page.kind), faqItemCount);
    } catch (error) {
        console.log("[STORE_PAGES]", error instanceof Error ? error.message : String(error));
        return publicPageFlags([], 0);
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
                metaPixelId: true,
                metaPixelEnabled: true,
                tiktokPixelId: true,
                tiktokPixelEnabled: true,
                bankTransferEnabled: true,
                ...STOREFRONT_SETTINGS_SELECT,
                _count: { select: { paymentAccounts: true } },
            },
        });

        if (!store) {
            return new NextResponse("Not found", { status: 404 });
        }

        // Pixel ids only while active (null when paused or not connected);
        // the enabled flags stay private. bankTransferEnabled = bank transfer is
        // available at checkout (enabled AND at least one account); the
        // accounts themselves are never returned here. announcement = the text
        // only while enabled (announcementEnabled stays private); socialLinks
        // is always an object of canonical profile URLs or nulls. pages = which
        // Store pages are live (enabled with content); their text is read from
        // /api/:storeId/pages/:kind.
        return NextResponse.json({
            id: store.id,
            name: store.name,
            logoUrl: store.logoUrl,
            faviconUrl: store.faviconUrl,
            ...publicPixelIds(store),
            bankTransferEnabled: isBankTransferAvailable(
                store.bankTransferEnabled,
                store._count.paymentAccounts,
            ),
            announcement: publicAnnouncement(store),
            socialLinks: publicSocialLinks(store),
            pages: await loadPageFlags(store.id),
        });
    } catch (error) {
        console.log("[PUBLIC_STORE_GET]", error);
        return new NextResponse("Internal error", { status: 500 });
    }
}
