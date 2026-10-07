import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs";

import { buildPackingSlipModel } from "@/lib/packing-slip";
import { loadPackingSlipData } from "@/lib/packing-slip-data";

import { SlipMessage, SlipView } from "./slip-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Packing slip",
};

// /{storeId}/orders/{orderId}/slip: the printable packing slip, opened in a new
// tab from the Orders page. The order is read Store-scoped; another Store's or
// an unknown order shows "Order not found".
const PackingSlipPage = async ({
  params,
}: {
  params: { storeId: string; orderId: string };
}) => {
  const { userId } = auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const data = await loadPackingSlipData({
    storeId: params.storeId,
    orderId: params.orderId,
    userId,
  });

  if (data.status === "store-not-found") {
    redirect("/");
  }

  if (data.status === "order-not-found") {
    return <SlipMessage title="Order not found" />;
  }

  const withoutPrices = buildPackingSlipModel(data.order, data.store, { showPrices: false });

  if (withoutPrices.senderIncomplete) {
    return (
      <SlipMessage
        title="Add your sender details in Settings to print packing slips."
        link={{ href: `/${params.storeId}/settings`, label: "Go to Settings" }}
      />
    );
  }

  const withPrices = buildPackingSlipModel(data.order, data.store, { showPrices: true });

  return <SlipView withoutPrices={withoutPrices} withPrices={withPrices} />;
};

export default PackingSlipPage;
