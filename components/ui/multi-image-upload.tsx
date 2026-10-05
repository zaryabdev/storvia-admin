"use client";

import { CldUploadWidget } from "next-cloudinary";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ImagePlus, Star, Trash } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MAX_PRODUCT_IMAGES } from "@/lib/product-images";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_FORMATS = ["jpg", "jpeg", "png", "webp"];

interface MultiImageUploadProps {
  /** Image URLs in display order; the first one is the cover. */
  value: string[];
  onChange: (urls: string[]) => void;
  disabled?: boolean;
  max?: number;
}

// Product photo list with ordering. Reordering uses buttons, not drag and
// drop. (The single-image ImageUpload used by billboards / logo / favicon is
// unchanged.)
const MultiImageUpload: React.FC<MultiImageUploadProps> = ({
  value,
  onChange,
  disabled,
  max = MAX_PRODUCT_IMAGES,
}) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // The widget calls the upload callback once PER FILE, possibly several times
  // before React re-renders, so every append builds on the latest list (kept
  // in a ref) rather than on the `value` captured by that render.
  const latest = useRef(value);
  latest.current = value;

  const commit = (urls: string[]) => {
    latest.current = urls;
    onChange(urls);
  };

  const onUpload = (result: any) => {
    const url: unknown = result?.info?.secure_url;

    if (typeof url !== "string" || latest.current.includes(url) || latest.current.length >= max) {
      return;
    }

    commit([...latest.current, url]);
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= value.length) {
      return;
    }

    const next = [...value];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    commit(next);
  };

  const remove = (index: number) => commit(value.filter((_, i) => i !== index));

  if (!isMounted) {
    return null;
  }

  const remaining = Math.max(max - value.length, 0);
  const iconButton =
    "h-11 w-11 shrink-0 p-0";

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-muted-foreground">
          Up to {max} photos. The first photo is the cover shown in listings.
        </p>
        <p className="font-medium" aria-live="polite">
          {value.length} / {max}
        </p>
      </div>
      {value.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {value.map((url, index) => {
            const position = index + 1;

            return (
              <li key={`${url}-${index}`} className="min-w-0 space-y-2">
                <div className="relative aspect-square w-full overflow-hidden rounded-md border">
                  <Image fill className="object-cover" alt={`Product photo ${position}`} src={url} />
                  {index === 0 && (
                    <span className="absolute left-2 top-2 z-10 rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">
                      Cover
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {index > 0 && (
                    <Button
                      type="button"
                      variant="secondary"
                      className={iconButton}
                      disabled={disabled}
                      aria-label={`Move image ${position} left`}
                      onClick={() => move(index, index - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  )}
                  {index < value.length - 1 && (
                    <Button
                      type="button"
                      variant="secondary"
                      className={iconButton}
                      disabled={disabled}
                      aria-label={`Move image ${position} right`}
                      onClick={() => move(index, index + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  )}
                  {index > 0 && (
                    <Button
                      type="button"
                      variant="secondary"
                      className={iconButton}
                      disabled={disabled}
                      aria-label={`Set image ${position} as cover`}
                      onClick={() => move(index, 0)}
                    >
                      <Star className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="destructive"
                    className={iconButton}
                    disabled={disabled}
                    aria-label={`Remove image ${position}`}
                    onClick={() => remove(index)}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {remaining > 0 ? (
        <CldUploadWidget
          onUpload={onUpload}
          uploadPreset="tbck4c3k"
          options={{
            multiple: true,
            maxFiles: remaining,
            clientAllowedFormats: ALLOWED_FORMATS,
            maxFileSize: MAX_FILE_SIZE_BYTES,
          }}
        >
          {({ open }) => (
            <Button
              type="button"
              disabled={disabled}
              variant="secondary"
              className="min-h-[44px]"
              onClick={() => open()}
            >
              <ImagePlus className="mr-2 h-4 w-4" />
              Upload photos
            </Button>
          )}
        </CldUploadWidget>
      ) : (
        <p className="text-sm text-muted-foreground">Photo limit reached. Remove one to add another.</p>
      )}
    </div>
  );
};

export default MultiImageUpload;
