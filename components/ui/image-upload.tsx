"use client";

import { CldUploadWidget } from 'next-cloudinary';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ImagePlus, Trash } from 'lucide-react';
import Image from 'next/image';

import { signedUploadWidget, type MediaFolder } from '@/lib/media';

const MB = 1024 * 1024;
const PHOTO_FORMATS = ['jpg', 'jpeg', 'png', 'webp'];

// Folder, formats and file-size cap per use (the widget also downscales to
// 2000 px). DECISIONS.md → Image delivery and uploads.
const UPLOAD_KINDS: Record<
  'logo' | 'favicon' | 'qr',
  { folder: MediaFolder; formats: string[]; maxFileSize: number }
> = {
  logo: { folder: 'branding', formats: PHOTO_FORMATS, maxFileSize: 2 * MB },
  favicon: { folder: 'branding', formats: ['png'], maxFileSize: 1 * MB },
  qr: { folder: 'payments', formats: PHOTO_FORMATS, maxFileSize: 2 * MB },
};

interface ImageUploadProps {
  disabled?: boolean;
  onChange: (value: string) => void;
  onRemove: (value: string) => void;
  value: string[];
  kind: keyof typeof UPLOAD_KINDS;
}

const ImageUpload: React.FC<ImageUploadProps> = ({
  disabled,
  onChange,
  onRemove,
  value,
  kind
}) => {
  const params = useParams();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const onUpload = (result: any) => {
    onChange(result.info.secure_url);
  };

  if (!isMounted) {
    return null;
  }

  const upload = UPLOAD_KINDS[kind];
  const widget = signedUploadWidget(params.storeId, upload.folder);

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-4 sm:flex sm:flex-wrap sm:items-center">
        {value.map((url) => (
          <div
            key={url}
            className="relative aspect-square w-full min-w-0 max-w-[200px] overflow-hidden rounded-md sm:h-[200px] sm:w-[200px] sm:max-w-none sm:aspect-auto"
          >
            <div className="absolute z-10 top-2 right-2">
              <Button type="button" onClick={() => onRemove(url)} variant="destructive" size="sm">
                <Trash className="w-4 h-4" />
              </Button>
            </div>
            <Image
              fill
              className="object-cover"
              alt="Image"
              sizes="200px"
              src={url}
            />
          </div>
        ))}
      </div>
      <CldUploadWidget
        onUpload={onUpload}
        uploadPreset={widget.uploadPreset}
        signatureEndpoint={widget.signatureEndpoint}
        options={{
          ...widget.options,
          multiple: false,
          clientAllowedFormats: upload.formats,
          maxFileSize: upload.maxFileSize,
        }}
      >
        {({ open }) => {
          const onClick = () => {
            open();
          };

          return (
            <Button
              type="button"
              disabled={disabled}
              variant="secondary"
              onClick={onClick}
            >
              <ImagePlus className="w-4 h-4 mr-2" />
              Upload an Image
            </Button>
          );
        }}
      </CldUploadWidget>
    </div>
  );
}

export default ImageUpload;
