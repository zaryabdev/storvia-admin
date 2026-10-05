import prismadb from "@/lib/prismadb";

import { SizeForm } from "./components/size-form";

const SizePage = async ({
  params
}: {
  params: { sizeId: string, storeId: string }
}) => {
  const size = await prismadb.size.findFirst({
    where: {
      id: params.sizeId,
      storeId: params.storeId,
    }
  });

  return ( 
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-4 pt-4 sm:p-6 sm:pt-6 lg:p-8 lg:pt-6">
        <SizeForm initialData={size} />
      </div>
    </div>
  );
}

export default SizePage;
