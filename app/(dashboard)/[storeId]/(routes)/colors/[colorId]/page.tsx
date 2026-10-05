import prismadb from "@/lib/prismadb";

import { ColorForm } from "./components/color-form";

const ColorPage = async ({
  params
}: {
  params: { colorId: string, storeId: string }
}) => {
  const color = await prismadb.color.findFirst({
    where: {
      id: params.colorId,
      storeId: params.storeId,
    }
  });

  return ( 
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-4 pt-4 sm:p-6 sm:pt-6 lg:p-8 lg:pt-6">
        <ColorForm initialData={color} />
      </div>
    </div>
  );
}

export default ColorPage;
