// Image uploads (Cloudinary, signed preset) and the stored-URL rule. Plain
// module (no Prisma, React or node:crypto): shared by the sign route, every
// route that stores an image URL, the upload components and the forms'
// client-side validation. Rules: DECISIONS.md → Image delivery and uploads.

export const MEDIA_FOLDERS = ["products", "billboards", "branding", "payments"] as const;
export type MediaFolder = (typeof MEDIA_FOLDERS)[number];

// Uploads are downscaled in the browser to fit this box (the preset also
// limits incoming images to 2000×2000).
export const MAX_IMAGE_DIMENSION = 2000;

export const UPLOADER_URL_MESSAGE = "Upload the image with the uploader";
export const FAVICON_PNG_MESSAGE = "The favicon must be a PNG image";

// One Store's Cloudinary folder for one kind of image.
export const mediaFolder = (storeId: string, folder: MediaFolder) => `storvia/${storeId}/${folder}`;

// CldUploadWidget props shared by both upload components: the signed preset,
// this Store's sign route and folder, and the browser-side downscale.
export function signedUploadWidget(storeId: string, folder: MediaFolder) {
  return {
    uploadPreset: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET,
    signatureEndpoint: `/api/stores/${storeId}/media/sign`,
    options: {
      folder: mediaFolder(storeId, folder),
      maxImageWidth: MAX_IMAGE_DIMENSION,
      maxImageHeight: MAX_IMAGE_DIMENSION,
    },
  };
}

// https://res.cloudinary.com/<cloud>/image/upload/, or null (logged) when the
// cloud name is not configured.
function uploadedImagePrefix(): string | null {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

  if (!cloudName) {
    console.error("[MEDIA_URL] NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME is not set");
    return null;
  }

  return `https://res.cloudinary.com/${cloudName}/image/upload/`;
}

// null when `url` is an image uploaded to this app's Cloudinary cloud (and,
// with `png`, a .png file); otherwise the 400 message. Callers keep their own
// https and length checks.
export function uploadedImageUrlError(url: string, options: { png?: boolean } = {}): string | null {
  const prefix = uploadedImagePrefix();

  if (!prefix || !url.startsWith(prefix)) {
    return UPLOADER_URL_MESSAGE;
  }

  let pathname: string;

  try {
    const parsed = new URL(url);

    // Rejects paths such as ".../image/upload/../../" that leave the prefix.
    if (!parsed.href.startsWith(prefix)) {
      return UPLOADER_URL_MESSAGE;
    }

    pathname = parsed.pathname;
  } catch {
    return UPLOADER_URL_MESSAGE;
  }

  if (options.png && !pathname.endsWith(".png")) {
    return FAVICON_PNG_MESSAGE;
  }

  return null;
}
