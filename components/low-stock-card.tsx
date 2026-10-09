import Link from "next/link";
import { PackageMinus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LowStockProduct } from "@/actions/get-low-stock-products";

interface LowStockCardProps {
  storeId: string;
  products: LowStockProduct[];
  /** Every low product, including those not listed. */
  total: number;
}

export const LowStockCard: React.FC<LowStockCardProps> = ({ storeId, products, total }) => {
  const more = total - products.length;

  return (
    <Card className="min-w-0">
      <CardHeader className="flex min-w-0 flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="min-w-0 break-words text-sm font-medium">Low stock</CardTitle>
        <PackageMinus className="h-4 w-4 shrink-0 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {products.length === 0 ? (
          <div className="space-y-1">
            <p className="text-sm font-medium">All stocked up</p>
            <p className="text-sm text-muted-foreground">
              No products are at or below their low-stock threshold.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <ul className="divide-y">
              {products.map((product) => (
                <li key={product.id} className="flex min-w-0 items-center justify-between gap-3">
                  <Link
                    href={`/${storeId}/products/${product.id}`}
                    className="block min-w-0 truncate py-3 text-sm font-medium leading-5 rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    {product.name}
                  </Link>
                  {product.quantity <= 0 ? (
                    <Badge variant="destructive" className="shrink-0">Out of stock</Badge>
                  ) : (
                    <span className="shrink-0 text-sm text-muted-foreground">
                      {product.quantity} left · alert at {product.threshold}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {more > 0 ? (
              <p className="text-sm text-muted-foreground">and {more} more</p>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
