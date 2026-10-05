import prismadb from "@/lib/prismadb";

// Merchant routes authorize the caller against `params.storeId`, so every row
// they mutate, and every id a request body points at, must belong to that
// same Store. A row in another Store is treated exactly like a missing one.
// A row's `storeId` is never changed by any endpoint, so check-then-write is
// safe.

export type StoreScopedModel = "billboard" | "category" | "size" | "color" | "product";

export async function existsInStore(
  model: StoreScopedModel,
  id: string,
  storeId: string,
): Promise<boolean> {
  const where = { id, storeId };

  switch (model) {
    case "billboard":
      return (await prismadb.billboard.count({ where })) > 0;
    case "category":
      return (await prismadb.category.count({ where })) > 0;
    case "size":
      return (await prismadb.size.count({ where })) > 0;
    case "color":
      return (await prismadb.color.count({ where })) > 0;
    case "product":
      return (await prismadb.product.count({ where })) > 0;
  }
}

export interface StoreReferences {
  categoryId?: unknown;
  sizeId?: unknown;
  colorId?: unknown;
  billboardId?: unknown;
}

const REFERENCES: Array<[keyof StoreReferences, StoreScopedModel, string]> = [
  ["categoryId", "category", "Category not found"],
  ["sizeId", "size", "Size not found"],
  ["colorId", "color", "Color not found"],
  ["billboardId", "billboard", "Billboard not found"],
];

// Returns an error message for the first referenced id that does not belong
// to the Store, or null when every given id is the Store's own. Empty ids
// (undefined / null / "") are skipped: required-field checks stay in the
// routes.
export async function findForeignReference(
  storeId: string,
  refs: StoreReferences,
): Promise<string | null> {
  for (const [key, model, message] of REFERENCES) {
    const id = refs[key];

    if (id === undefined || id === null || id === "") {
      continue;
    }

    if (typeof id !== "string" || !(await existsInStore(model, id, storeId))) {
      return message;
    }
  }

  return null;
}
