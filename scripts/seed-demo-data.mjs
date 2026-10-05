// Repeatable development/demo data seed for one Store.
//
// Resets ONE Store's catalog (Billboards, Categories, Products, Images,
// Sizes, Colors) and its Orders, then recreates a coherent "Norwood &
// Fields" apparel/accessories catalog for Storefront presentation.
//
// Deliberately does NOT touch: the Store row itself (name only), Clerk
// ownership, StoreBillingProfile, BillingPlan, Invoice, Payment,
// PaymentEvidence — this Store has no billing data, and this script never
// deletes/recreates the Store row, so those relations are never at risk.
//
// Usage:
//   ALLOW_DEMO_DATA_RESET=true DEMO_STORE_ID=<store-id> node scripts/seed-demo-data.mjs
// or:
//   npm run seed:demo -- (reads DEMO_STORE_ID from the environment)
//
// Safety: refuses to run unless NODE_ENV !== "production" AND
// ALLOW_DEMO_DATA_RESET=true AND an explicit DEMO_STORE_ID is given. No
// store id is hardcoded here on purpose — an accidental default could wipe
// the wrong store in a different environment later.

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

function abort(message) {
    console.error(`\n[seed-demo-data] Aborted — ${message}\n`);
    process.exit(1);
}

function assertSafeToRun() {
    if (process.env.NODE_ENV === "production") {
        abort('NODE_ENV is "production" — refusing to run against production.');
    }
    if (process.env.ALLOW_DEMO_DATA_RESET !== "true") {
        abort(
            "Set ALLOW_DEMO_DATA_RESET=true to confirm you want to reset this Store's demo data.",
        );
    }
    const storeId = process.env.DEMO_STORE_ID;
    if (!storeId) {
        abort(
            "Set DEMO_STORE_ID=<store-id> to the Store you want to reset/reseed. Nothing is assumed.",
        );
    }
    return storeId;
}

// The only 10 already-uploaded, verified-live Cloudinary URLs found across
// the entire dev database (across all Stores) at the time this script was
// written — every URL confirmed HTTP 200 on res.cloudinary.com, the exact
// domain already whitelisted in storvia-storefront/next.config.js. This
// account's Cloudinary "fetch" delivery (which would allow referencing any
// external stock photo through this same allowed domain) was tested and
// confirmed disabled (401). No new image hosting was introduced — these
// are reused/cycled across the catalog, so several products intentionally
// share a photo rather than each having a unique one. See the task report
// for the full reasoning.
const IMAGE_POOL = [
    "https://res.cloudinary.com/dxnchz8yn/image/upload/v1772357271/pcmomzufh75z5hon92zy.jpg",
    "https://res.cloudinary.com/dxnchz8yn/image/upload/v1772357310/c2yjhs8bmlipnqioxrja.jpg",
    "https://res.cloudinary.com/dxnchz8yn/image/upload/v1772357705/lm13qits7zcs6n4ub2fh.jpg",
    "https://res.cloudinary.com/dxnchz8yn/image/upload/v1772357732/scojq0lgpne9xaudnptc.jpg",
    "https://res.cloudinary.com/dxnchz8yn/image/upload/v1790601548/jdaxkigh9bw0htaiojwi.png",
    "https://res.cloudinary.com/dxnchz8yn/image/upload/v1772356477/evqjfuj8erfzssnrrnn6.png",
    "https://res.cloudinary.com/dxnchz8yn/image/upload/v1772357563/ojvuufymhhtmophjh3dl.jpg",
    "https://res.cloudinary.com/dxnchz8yn/image/upload/v1772357156/nkqpmudx4haffzldbox7.jpg",
    "https://res.cloudinary.com/dxnchz8yn/image/upload/v1789472290/zjz9pqoswnxf2nibsh7k.png",
    "https://res.cloudinary.com/dxnchz8yn/image/upload/v1789632040/b3czbm9f9gblecjggvew.png",
];

// This Store's own existing (already-verified) billboard image — reused
// for the new single homepage billboard rather than pulled from another
// Store's pool, since it's already scoped to this Store.
const BILLBOARD_IMAGE_URL = IMAGE_POOL[8];

function imagesForProduct(index) {
    const primary = IMAGE_POOL[index % IMAGE_POOL.length];
    // Every 3rd product gets a second image, so PDP Gallery (multi-image
    // tab switching) is meaningfully exercised on a real subset, not just
    // a single-image fallback everywhere.
    if (index % 3 === 0) {
        const extra = IMAGE_POOL[(index + 4) % IMAGE_POOL.length];
        return [primary, extra];
    }
    return [primary];
}

const STORE_NAME = "Norwood & Fields";

const CATEGORY_DEFS = [
    { key: "MEN", name: "Men" },
    { key: "MEN_SHIRTS", name: "Shirts", parent: "MEN" },
    { key: "MEN_TEES", name: "T-Shirts", parent: "MEN" },
    { key: "MEN_TROUSERS", name: "Trousers", parent: "MEN" },
    { key: "WOMEN", name: "Women" },
    { key: "WOMEN_TOPS", name: "Tops", parent: "WOMEN" },
    { key: "WOMEN_DRESSES", name: "Dresses", parent: "WOMEN" },
    { key: "ACCESSORIES", name: "Accessories" },
    { key: "ACC_JEWELRY", name: "Jewelry", parent: "ACCESSORIES" },
    { key: "ACC_WATCHES", name: "Watches", parent: "ACCESSORIES" },
    { key: "ACC_BAGS", name: "Bags", parent: "ACCESSORIES" },
    { key: "FOOTWEAR", name: "Footwear" },
    { key: "OUTERWEAR", name: "Outerwear" },
];

const SIZE_DEFS = [
    { key: "S", name: "Small", value: "S" },
    { key: "M", name: "Medium", value: "M" },
    { key: "L", name: "Large", value: "L" },
    { key: "XL", name: "Extra Large", value: "XL" },
    { key: "ONE_SIZE", name: "One Size", value: "OS" },
    { key: "UK7", name: "UK 7", value: "UK7" },
    { key: "UK8", name: "UK 8", value: "UK8" },
    { key: "UK9", name: "UK 9", value: "UK9" },
];

const COLOR_DEFS = [
    { key: "BLACK", name: "Black", value: "#111111" },
    { key: "WHITE", name: "White", value: "#F5F5F0" },
    { key: "NAVY", name: "Navy", value: "#1F2A44" },
    { key: "CHARCOAL", name: "Charcoal", value: "#36454F" },
    { key: "BEIGE", name: "Beige", value: "#E8DCC8" },
    { key: "OLIVE", name: "Olive", value: "#6B6B3A" },
    { key: "BURGUNDY", name: "Burgundy", value: "#6E1B2E" },
    { key: "TAN", name: "Tan", value: "#C7A16B" },
    { key: "GOLD", name: "Gold", value: "#C9A24B" },
    { key: "SILVER", name: "Silver", value: "#B7BBC0" },
];

// One row = one actual sellable size/color combination — no variant matrix.
const PRODUCT_DEFS = [
    { name: "Classic Oxford Shirt", category: "MEN_SHIRTS", size: "M", color: "WHITE", price: 3800, quantity: 18, featured: true },
    { name: "Brushed Flannel Shirt", category: "MEN_SHIRTS", size: "L", color: "OLIVE", price: 4200, quantity: 10 },
    { name: "Linen Overshirt", category: "MEN_SHIRTS", size: "M", color: "BEIGE", price: 4500, quantity: 6 },

    { name: "Relaxed Cotton Tee", category: "MEN_TEES", size: "M", color: "BLACK", price: 2200, quantity: 25, featured: true },
    { name: "Heavyweight Pocket Tee", category: "MEN_TEES", size: "L", color: "CHARCOAL", price: 2600, quantity: 20 },
    { name: "Striped Crew Tee", category: "MEN_TEES", size: "S", color: "NAVY", price: 2400, quantity: 14 },
    { name: "Garment-Dyed Tee", category: "MEN_TEES", size: "M", color: "TAN", price: 2300, quantity: 0 },

    { name: "Straight-Leg Trousers", category: "MEN_TROUSERS", size: "M", color: "CHARCOAL", price: 4800, quantity: 16, featured: true },
    { name: "Tapered Chinos", category: "MEN_TROUSERS", size: "L", color: "BEIGE", price: 4500, quantity: 12 },
    { name: "Wool-Blend Trousers", category: "MEN_TROUSERS", size: "M", color: "NAVY", price: 5500, quantity: 4 },

    { name: "Silk Cami Top", category: "WOMEN_TOPS", size: "S", color: "BURGUNDY", price: 3200, quantity: 15 },
    { name: "Ribbed Knit Top", category: "WOMEN_TOPS", size: "M", color: "BLACK", price: 2800, quantity: 18 },
    { name: "Relaxed Poplin Blouse", category: "WOMEN_TOPS", size: "M", color: "WHITE", price: 3400, quantity: 10 },
    { name: "Cropped Shirt Top", category: "WOMEN_TOPS", size: "S", color: "OLIVE", price: 3000, quantity: 8 },

    { name: "Wrap Midi Dress", category: "WOMEN_DRESSES", size: "M", color: "BURGUNDY", price: 6500, quantity: 12, featured: true },
    { name: "Linen Shirt Dress", category: "WOMEN_DRESSES", size: "M", color: "BEIGE", price: 7200, quantity: 6 },
    { name: "Slip Dress", category: "WOMEN_DRESSES", size: "S", color: "BLACK", price: 5800, quantity: 3 },

    { name: "Sterling Signet Ring", category: "ACC_JEWELRY", size: "ONE_SIZE", color: "SILVER", price: 5200, quantity: 14 },
    { name: "Layered Chain Necklace", category: "ACC_JEWELRY", size: "ONE_SIZE", color: "GOLD", price: 6800, quantity: 9 },
    { name: "Pearl Drop Earrings", category: "ACC_JEWELRY", size: "ONE_SIZE", color: "GOLD", price: 4200, quantity: 20 },

    { name: "Classic Leather-Strap Watch", category: "ACC_WATCHES", size: "ONE_SIZE", color: "TAN", price: 18500, quantity: 8, featured: true },
    { name: "Minimalist Steel Watch", category: "ACC_WATCHES", size: "ONE_SIZE", color: "SILVER", price: 22000, quantity: 5 },
    { name: "Chronograph Watch", category: "ACC_WATCHES", size: "ONE_SIZE", color: "BLACK", price: 28500, quantity: 2 },

    { name: "Everyday Tote", category: "ACC_BAGS", size: "ONE_SIZE", color: "TAN", price: 7500, quantity: 16, featured: true },
    { name: "Structured Crossbody Bag", category: "ACC_BAGS", size: "ONE_SIZE", color: "BLACK", price: 8900, quantity: 11 },
    { name: "Leather Weekender Bag", category: "ACC_BAGS", size: "ONE_SIZE", color: "CHARCOAL", price: 15500, quantity: 4 },

    { name: "Canvas Low-Top Sneakers", category: "FOOTWEAR", size: "UK8", color: "WHITE", price: 5500, quantity: 22 },
    { name: "Leather Chelsea Boots", category: "FOOTWEAR", size: "UK9", color: "BLACK", price: 9500, quantity: 9, featured: true },
    { name: "Suede Loafers", category: "FOOTWEAR", size: "UK8", color: "TAN", price: 8200, quantity: 13 },
    { name: "Classic Leather Sneakers", category: "FOOTWEAR", size: "UK7", color: "WHITE", price: 7800, quantity: 17 },

    { name: "Wool Overcoat", category: "OUTERWEAR", size: "L", color: "CHARCOAL", price: 16500, quantity: 6, featured: true },
    { name: "Quilted Bomber Jacket", category: "OUTERWEAR", size: "M", color: "OLIVE", price: 11500, quantity: 10 },
];

async function resetStoreData(tx, storeId) {
    // Break the Store <-> Billboard circular FK before deleting Billboards.
    await tx.store.update({ where: { id: storeId }, data: { homepageBillboardId: null } });

    await tx.orderItem.deleteMany({ where: { order: { storeId } } });
    await tx.order.deleteMany({ where: { storeId } });

    // Cascades to Image automatically (Image.product has onDelete: Cascade).
    await tx.product.deleteMany({ where: { storeId } });

    // Children before parents (Category.parent has onDelete: Restrict).
    await tx.category.deleteMany({ where: { storeId, parentId: { not: null } } });
    await tx.category.deleteMany({ where: { storeId, parentId: null } });

    await tx.billboard.deleteMany({ where: { storeId } });
    await tx.size.deleteMany({ where: { storeId } });
    await tx.color.deleteMany({ where: { storeId } });
}

async function seedStoreData(tx, storeId) {
    await tx.store.update({ where: { id: storeId }, data: { name: STORE_NAME } });

    const colors = new Map();
    for (const c of COLOR_DEFS) {
        colors.set(c.key, await tx.color.create({ data: { storeId, name: c.name, value: c.value } }));
    }

    const sizes = new Map();
    for (const s of SIZE_DEFS) {
        sizes.set(s.key, await tx.size.create({ data: { storeId, name: s.name, value: s.value } }));
    }

    const categories = new Map();
    for (const c of CATEGORY_DEFS.filter((c) => !c.parent)) {
        categories.set(c.key, await tx.category.create({ data: { storeId, name: c.name } }));
    }
    for (const c of CATEGORY_DEFS.filter((c) => c.parent)) {
        categories.set(
            c.key,
            await tx.category.create({
                data: { storeId, name: c.name, parentId: categories.get(c.parent).id },
            }),
        );
    }

    const billboard = await tx.billboard.create({
        data: {
            storeId,
            label: "New Season, Timeless Essentials",
            imageUrl: BILLBOARD_IMAGE_URL,
        },
    });
    await tx.store.update({ where: { id: storeId }, data: { homepageBillboardId: billboard.id } });

    let created = 0;
    let featuredCount = 0;
    let outOfStockCount = 0;
    for (const [index, p] of PRODUCT_DEFS.entries()) {
        await tx.product.create({
            data: {
                storeId,
                name: p.name,
                price: p.price,
                quantity: p.quantity,
                isFeatured: Boolean(p.featured),
                categoryId: categories.get(p.category).id,
                sizeId: sizes.get(p.size).id,
                colorId: colors.get(p.color).id,
                images: { create: imagesForProduct(index).map((url, position) => ({ url, position })) },
            },
        });
        created += 1;
        if (p.featured) featuredCount += 1;
        if (p.quantity === 0) outOfStockCount += 1;
    }

    return {
        storeName: STORE_NAME,
        categories: categories.size,
        products: created,
        featuredProducts: featuredCount,
        outOfStock: outOfStockCount,
        billboards: 1,
        sizes: sizes.size,
        colors: colors.size,
    };
}

async function main() {
    const storeId = assertSafeToRun();

    const store = await db.store.findUnique({ where: { id: storeId }, select: { id: true, name: true } });
    if (!store) {
        abort(`No Store found with id "${storeId}".`);
    }

    console.log(`[seed-demo-data] Target Store: "${store.name}" (${store.id})`);
    console.log("[seed-demo-data] Resetting and reseeding this Store's catalog...");

    const summary = await db.$transaction(
        async (tx) => {
            await resetStoreData(tx, storeId);
            return seedStoreData(tx, storeId);
        },
        {
            maxWait: 10_000,
            timeout: 60_000,
        },
    );

    console.log("\nDemo seed completed\n");
    console.log(`Store: ${summary.storeName}`);
    console.log(`Categories: ${summary.categories}`);
    console.log(`Sizes: ${summary.sizes}`);
    console.log(`Colors: ${summary.colors}`);
    console.log(`Products: ${summary.products}`);
    console.log(`Featured products: ${summary.featuredProducts}`);
    console.log(`Out of stock: ${summary.outOfStock}`);
    console.log(`Billboards: ${summary.billboards}`);
}

main()
    .catch((error) => {
        console.error("[seed-demo-data] Failed:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await db.$disconnect();
    });
