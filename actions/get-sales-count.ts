import { getStoreSalesCount } from "@/lib/store-sales";

// Number of eligible orders (CONFIRMED + DELIVERED).
export const getSalesCount = async (storeId: string) => {
  const salesCount = await getStoreSalesCount(storeId);

  return salesCount;
};
