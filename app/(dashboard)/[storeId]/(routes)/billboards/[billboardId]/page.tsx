import prismadb from "@/lib/prismadb";
import { PRODUCT_IMAGE_ORDER } from "@/lib/product-images";

import { BillboardForm } from "./components/billboard-form";

const BillboardPage = async ({
  params
}: {
  params: { billboardId: string, storeId: string }
}) => {
  const billboard = await prismadb.billboard.findFirst({
    where: {
      id: params.billboardId,
      storeId: params.storeId,
    },
    include: {
      images: { orderBy: [...PRODUCT_IMAGE_ORDER] },
    }
  });

  // Button targets: this Store's categories, subcategories listed under their parent.
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

  return ( 
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-4 pt-4 sm:p-6 sm:pt-6 lg:p-8 lg:pt-6">
        <BillboardForm initialData={billboard} categories={categories} />
      </div>
    </div>
  );
}

export default BillboardPage;
