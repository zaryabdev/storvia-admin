import prismadb from "@/lib/prismadb";

import { CategoryForm } from "./components/category-form";

const CategoryPage = async ({
  params
}: {
  params: { categoryId: string, storeId: string }
}) => {
  const category = await prismadb.category.findFirst({
    where: {
      id: params.categoryId,
      storeId: params.storeId,
    },
    include: {
      children: true,
    }
  });

  const billboards = await prismadb.billboard.findMany({
    where: {
      storeId: params.storeId
    }
  });

  const categories = await prismadb.category.findMany({
    where: {
      storeId: params.storeId,
      parentId: null,
      NOT: {
        id: params.categoryId,
      }
    }
  });

  return (
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-4 pt-4 sm:p-6 sm:pt-6 lg:p-8 lg:pt-6">
        <CategoryForm billboards={billboards} categories={categories} initialData={category} />
      </div>
    </div>
  );
}

export default CategoryPage;
