export const MAX_PRODUCT_IMAGES = 8;

// Every read that includes a Product's images uses this order: the
// merchant-chosen position first, then creation time for legacy rows
// (all position 0).
export const PRODUCT_IMAGE_ORDER = [
  { position: "asc" },
  { createdAt: "asc" },
] as const;

// Returns an error message, or null when `images` is a valid ordered list
// (an array of at most `max` entries, each with a non-empty https `url`).
// `noun` names the owner in the limit message ("product", "billboard").
// Presence/minimum checks stay in the routes.
export function validateImageList(
  images: unknown,
  max: number,
  noun: string,
): string | null {
  if (!Array.isArray(images)) {
    return "Images must be an array";
  }

  if (images.length > max) {
    return `A ${noun} can have at most ${max} images`;
  }

  for (const image of images) {
    const url = image && typeof image === "object" ? (image as { url?: unknown }).url : undefined;

    if (typeof url !== "string" || url.trim() === "") {
      return "Each image needs a URL";
    }

    try {
      if (new URL(url).protocol !== "https:") {
        return "Image URLs must use https";
      }
    } catch {
      return "Image URLs must use https";
    }
  }

  return null;
}

// Products: at most 8 images.
export function validateProductImages(images: unknown): string | null {
  return validateImageList(images, MAX_PRODUCT_IMAGES, "product");
}

// Rows to create: only `url`, with `position` = index in the submitted array.
export function toImageRows(images: Array<{ url: string }>) {
  return images.map((image, position) => ({ url: image.url, position }));
}
