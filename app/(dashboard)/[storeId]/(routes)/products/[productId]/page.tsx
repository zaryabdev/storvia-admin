import prismadb from "@/lib/prismadb";
import { PRODUCT_IMAGE_ORDER } from "@/lib/product-images";
import { DEFAULT_LOW_STOCK_THRESHOLD } from "@/lib/stock";

import { ProductForm } from "./components/product-form";

const ProductPage = async ({
  params
}: {
  params: { productId: string, storeId: string }
}) => {
  const product = await prismadb.product.findFirst({
    where: {
      id: params.productId,
      storeId: params.storeId,
    },
    include: {
      images: { orderBy: [...PRODUCT_IMAGE_ORDER] },
    }
  });

  const categories = await prismadb.category.findMany({
    where: {
      storeId: params.storeId,
    },
    include: {
      parent: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  const sizes = await prismadb.size.findMany({
    where: {
      storeId: params.storeId,
    },
  });

  const colors = await prismadb.color.findMany({
    where: {
      storeId: params.storeId,
    },
  });

  // Only the default threshold (Store has Decimal columns; never pass a full row).
  const store = await prismadb.store.findUnique({
    where: { id: params.storeId },
    select: { lowStockThreshold: true },
  });

  return ( 
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-4 pt-4 sm:p-6 sm:pt-6 lg:p-8 lg:pt-6">
        <ProductForm 
          categories={categories} 
          colors={colors}
          sizes={sizes}
          initialData={product}
          storeLowStockThreshold={store?.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD}
        />
      </div>
    </div>
  );
}

export default ProductPage;
