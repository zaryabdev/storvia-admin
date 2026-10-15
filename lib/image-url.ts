const CLOUDINARY_UPLOAD = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/;

/**
 * Cloudinary delivery URL resized to `width` (never upscaled), served in the
 * best format the browser accepts. Anything that is not a Cloudinary upload
 * URL is returned unchanged.
 */
export function cloudinaryImageUrl(
  src: string,
  opts: { width: number; quality?: number },
): string {
  const match = CLOUDINARY_UPLOAD.exec(src);
  if (!match) return src;
  const [, base, rest] = match;
  return `${base}f_auto,q_${opts.quality ?? "auto"},c_limit,w_${opts.width}/${rest}`;
}
