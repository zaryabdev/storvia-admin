import { getStoreDeliveryFeesTotal } from "@/lib/store-sales";

// Delivery fees on eligible orders (CONFIRMED + DELIVERED), computed in
// Decimal; converted to a number only for the UI formatter.
export const getDeliveryFeesTotal = async (storeId: string) => {
  const total = await getStoreDeliveryFeesTotal(storeId);

  return total.toNumber();
};
