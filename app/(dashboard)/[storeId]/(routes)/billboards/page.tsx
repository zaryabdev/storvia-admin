import { format } from "date-fns";

import prismadb from "@/lib/prismadb";

import { BillboardColumn, LAYOUT_LABELS } from "./components/columns"
import { BillboardClient } from "./components/client";

const BillboardsPage = async ({
  params
}: {
  params: { storeId: string }
}) => {
  const billboards = await prismadb.billboard.findMany({
    where: {
      storeId: params.storeId
    },
    orderBy: {
      createdAt: 'desc'
    },
    include: {
      _count: { select: { images: true } }
    }
  });

  const store = await prismadb.store.findUnique({
    where: {
      id: params.storeId
    },
    select: {
      homepageBillboardId: true
    }
  });

  const formattedBillboards: BillboardColumn[] = billboards.map((item) => ({
    id: item.id,
    label: item.label,
    layout: LAYOUT_LABELS[item.layout],
    // Legacy rows without photo rows still have their cover.
    photoCount: Math.max(item._count.images, 1),
    createdAt: format(item.createdAt, 'MMMM do, yyyy'),
    isHomepage: item.id === store?.homepageBillboardId,
  }));

  return (
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-4 pt-4 sm:p-6 sm:pt-6 lg:p-8 lg:pt-6">
        <BillboardClient data={formattedBillboards} />
      </div>
    </div>
  );
};

export default BillboardsPage;
