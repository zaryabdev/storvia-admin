import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";

// Pre-checks for DELETE handlers. Each returns a plain-text message when the
// row is still referenced (the route answers 409), or null when it is free to
// delete. They run after the ownership and Store-scope checks. References are
// the foreign keys in prisma/schema.prisma.

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

const list = (parts: string[]) =>
  parts.length <= 1
    ? parts.join("")
    : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;

export async function sizeInUseMessage(sizeId: string): Promise<string | null> {
  const n = await prismadb.product.count({ where: { sizeId } });
  return n > 0
    ? `This size is used by ${plural(n, "product")}. Change or delete those products first.`
    : null;
}

export async function colorInUseMessage(colorId: string): Promise<string | null> {
  const n = await prismadb.product.count({ where: { colorId } });
  return n > 0
    ? `This color is used by ${plural(n, "product")}. Change or delete those products first.`
    : null;
}

export async function billboardInUseMessage(
  billboardId: string,
): Promise<string | null> {
  const [categories, homepage] = await Promise.all([
    prismadb.category.count({ where: { billboardId } }),
    prismadb.store.count({ where: { homepageBillboardId: billboardId } }),
  ]);

  if (categories > 0) {
    return `This billboard is used by ${plural(categories, "category", "categories")}. Change or delete those categories first.`;
  }

  if (homepage > 0) {
    return "This billboard is the homepage billboard. Choose another homepage billboard first.";
  }

  return null;
}

export async function categoryInUseMessage(
  categoryId: string,
): Promise<string | null> {
  const [children, products] = await Promise.all([
    prismadb.category.count({ where: { parentId: categoryId } }),
    prismadb.product.count({ where: { categoryId } }),
  ]);

  if (children === 0 && products === 0) {
    return null;
  }

  const parts: string[] = [];
  if (children > 0) parts.push(plural(children, "subcategory", "subcategories"));
  if (products > 0) parts.push(plural(products, "product"));

  return `This category has ${list(parts)}. Remove or reassign them first.`;
}

export async function productInUseMessage(
  productId: string,
): Promise<string | null> {
  const n = await prismadb.orderItem.count({ where: { productId } });
  return n > 0
    ? "This product has orders, so it can't be deleted. Archive it instead."
    : null;
}

export async function storeInUseMessage(storeId: string): Promise<string | null> {
  const store = await prismadb.store.findUnique({
    where: { id: storeId },
    select: {
      _count: {
        select: {
          products: true,
          categories: true,
          billboards: true,
          sizes: true,
          colors: true,
          orders: true,
          invoices: true,
        },
      },
    },
  });

  const c = store?._count;
  const products = c?.products ?? 0;
  const categories = c?.categories ?? 0;
  const billboards = c?.billboards ?? 0;
  const sizes = c?.sizes ?? 0;
  const colors = c?.colors ?? 0;
  const orders = c?.orders ?? 0;
  const invoices = c?.invoices ?? 0;

  const parts: string[] = [];
  if (products > 0) parts.push(plural(products, "product"));
  if (categories > 0) parts.push(plural(categories, "category", "categories"));
  if (billboards > 0) parts.push(plural(billboards, "billboard"));
  if (sizes > 0) parts.push(plural(sizes, "size"));
  if (colors > 0) parts.push(plural(colors, "color"));
  if (orders > 0) parts.push(plural(orders, "order"));
  if (invoices > 0) parts.push(plural(invoices, "invoice"));

  return parts.length > 0
    ? `This store still has ${list(parts)}. Remove them before deleting the store.`
    : null;
}

export const inUseResponse = (message: string) =>
  new NextResponse(message, { status: 409 });

// Backstop for a race between the pre-check and the delete: Prisma P2003
// (foreign key violation) and P2014 (required relation violation) become a
// 409, never a 500. Returns null for any other error.
export function foreignKeyConflictResponse(error: unknown): NextResponse | null {
  const code = (error as { code?: unknown } | null)?.code;

  return code === "P2003" || code === "P2014"
    ? inUseResponse("This item is still in use.")
    : null;
}
