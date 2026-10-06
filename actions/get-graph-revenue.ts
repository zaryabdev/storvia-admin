import { bucketMonthlyRevenue, getGraphWindow, getStoreSalesOrders } from "@/lib/store-sales";

interface GraphData {
  name: string;
  total: number;
}

// Last 12 UTC calendar months ending with the current one, by confirmedAt
// (createdAt for legacy orders without it). Rule: DECISIONS.md "Sales metrics".
export const getGraphRevenue = async (storeId: string): Promise<GraphData[]> => {
  const now = new Date();
  const { start, end } = getGraphWindow(now);

  const salesOrders = await getStoreSalesOrders(storeId, start, end);

  return bucketMonthlyRevenue(salesOrders, now);
};
