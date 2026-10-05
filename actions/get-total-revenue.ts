import { getStoreSalesTotal } from "@/lib/store-sales";

// Eligible sales (CONFIRMED + DELIVERED), computed in Decimal; converted to a
// number only for the UI formatter.
export const getTotalRevenue = async (storeId: string) => {
  const totalRevenue = await getStoreSalesTotal(storeId);

  return totalRevenue.toNumber();
};
