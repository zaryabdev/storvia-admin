import { BillboardLayout, Prisma } from "@prisma/client";

import { PRODUCT_IMAGE_ORDER, toImageRows, validateImageList } from "@/lib/product-images";

export const MAX_BILLBOARD_IMAGES = 5;
export const MAX_SUBHEADING_LENGTH = 160;
export const MAX_CTA_LABEL_LENGTH = 30;

// Public billboard reads (GET by id, homepage billboard): photos in the
// merchant's order (same rule as product images) and the button's category.
export const BILLBOARD_INCLUDE = {
  images: { orderBy: [...PRODUCT_IMAGE_ORDER] },
  ctaCategory: { select: { id: true, name: true } },
} satisfies Prisma.BillboardInclude;

export interface BillboardFields {
  label: string;
  // Cover: always the first photo.
  imageUrl: string;
  images: Array<{ url: string; position: number }>;
  // `undefined` = not sent: POST uses the column default, PATCH leaves the
  // stored value unchanged.
  layout?: BillboardLayout;
  subheading?: string | null;
  showSearch?: boolean;
  ctaLabel?: string | null;
  ctaCategoryId?: string | null;
}

const LAYOUTS = Object.values(BillboardLayout) as string[];

// "" and null clear a text field; anything else must be a string.
function optionalText(value: unknown): string | null | undefined | false {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

// Validates a billboard POST/PATCH body. Returns a 400 message, or the
// fields to write. The button category's Store scope is checked by the
// route (findForeignReference). Older clients that send only `imageUrl`
// (no `images`) still work: that URL becomes the single photo.
export function parseBillboardBody(
  body: any,
): { error: string } | { fields: BillboardFields } {
  const { label, imageUrl, images, layout, subheading, showSearch, ctaLabel, ctaCategoryId } =
    body ?? {};

  if (!label) {
    return { error: "Label is required" };
  }

  let list: unknown = images;

  if (list === undefined) {
    if (!imageUrl) {
      return { error: "Image URL is required" };
    }
    list = [{ url: imageUrl }];
  }

  if (Array.isArray(list) && list.length === 0) {
    return { error: "Images are required" };
  }

  const imagesError = validateImageList(list, MAX_BILLBOARD_IMAGES, "billboard");

  if (imagesError) {
    return { error: imagesError };
  }

  if (layout !== undefined && (typeof layout !== "string" || !LAYOUTS.includes(layout))) {
    return { error: "Invalid layout" };
  }

  const sub = optionalText(subheading);

  if (sub === false) {
    return { error: "Invalid subheading" };
  }

  if (sub && sub.length > MAX_SUBHEADING_LENGTH) {
    return { error: `Subheading must be at most ${MAX_SUBHEADING_LENGTH} characters` };
  }

  if (showSearch !== undefined && typeof showSearch !== "boolean") {
    return { error: "Show search must be true or false" };
  }

  // The button is all or nothing. Sending neither field leaves it unchanged.
  let cta: { ctaLabel?: string | null; ctaCategoryId?: string | null } = {};

  if (ctaLabel !== undefined || ctaCategoryId !== undefined) {
    const buttonLabel = optionalText(ctaLabel);
    const buttonCategory = optionalText(ctaCategoryId);

    if (buttonLabel === false) {
      return { error: "Invalid button label" };
    }

    if (buttonCategory === false) {
      return { error: "Category not found" };
    }

    if (Boolean(buttonLabel) !== Boolean(buttonCategory)) {
      return { error: "A button needs both a label and a category" };
    }

    if (buttonLabel && buttonLabel.length > MAX_CTA_LABEL_LENGTH) {
      return { error: `Button label must be at most ${MAX_CTA_LABEL_LENGTH} characters` };
    }

    cta = { ctaLabel: buttonLabel ?? null, ctaCategoryId: buttonCategory ?? null };
  }

  const rows = toImageRows(list as Array<{ url: string }>);

  return {
    fields: {
      label,
      imageUrl: rows[0].url,
      images: rows,
      layout: layout as BillboardLayout | undefined,
      subheading: sub,
      showSearch,
      ...cta,
    },
  };
}
