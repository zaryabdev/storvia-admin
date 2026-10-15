import { cloudinaryImageUrl } from "@/lib/image-url";

// Global next/image loader (next.config.js images.loaderFile): resizing is done
// by Cloudinary, not by Next's optimizer.
export default function imageLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  return cloudinaryImageUrl(src, { width, quality });
}
