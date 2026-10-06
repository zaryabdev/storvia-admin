"use client";

import { Badge } from "@/components/ui/badge";

import { CellAction } from "./cell-action";
import { ProductColumn } from "./columns";

interface ProductMobileRowProps {
  product: ProductColumn;
}

export function ProductMobileRow({ product }: ProductMobileRowProps) {
  return (
    <div className="rounded-md border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words font-medium">{product.name}</p>
          <p className="mt-1 break-words text-lg font-semibold [overflow-wrap:anywhere]">
            {product.price}
            {product.isOnSale && (
              <Badge variant="secondary" className="ml-2 align-middle">Sale</Badge>
            )}
          </p>
        </div>
        <div className="shrink-0">
          <CellAction data={product} />
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div className="min-w-0">
          <dt className="text-muted-foreground">Category</dt>
          <dd className="break-words font-medium">{product.category}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-muted-foreground">Size</dt>
          <dd className="break-words font-medium">{product.size}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-muted-foreground">Color</dt>
          <dd className="flex min-w-0 items-center gap-2 break-words font-medium">
            <span className="break-words">{product.color}</span>
            <span
              aria-hidden="true"
              className="h-5 w-5 shrink-0 rounded-full border"
              style={{ backgroundColor: product.color }}
            />
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-muted-foreground">Date</dt>
          <dd className="break-words font-medium">{product.createdAt}</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        <Badge variant={product.isArchived ? "destructive" : "secondary"}>
          {product.isArchived ? "Archived" : "Not archived"}
        </Badge>
        <Badge variant={product.isFeatured ? "default" : "secondary"}>
          {product.isFeatured ? "Featured" : "Not featured"}
        </Badge>
      </div>
    </div>
  );
}
