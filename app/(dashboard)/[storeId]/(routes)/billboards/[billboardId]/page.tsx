import prismadb from "@/lib/prismadb";

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
    }
  });

  return ( 
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-4 pt-4 sm:p-6 sm:pt-6 lg:p-8 lg:pt-6">
        <BillboardForm initialData={billboard} />
      </div>
    </div>
  );
}

export default BillboardPage;
