import { Banknote, CreditCard, Package, Truck } from "lucide-react";

import { Separator } from "@/components/ui/separator";
import { Overview } from "@/components/overview";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { getTotalRevenue } from "@/actions/get-total-revenue";
import { getSalesCount } from "@/actions/get-sales-count";
import { getGraphRevenue } from "@/actions/get-graph-revenue";
import { getStockCount } from "@/actions/get-stock-count";
import { getDeliveryFeesTotal } from "@/actions/get-delivery-fees-total";
import { formatter } from "@/lib/utils";

interface DashboardPageProps {
  params: {
    storeId: string;
  };
};

const DashboardPage: React.FC<DashboardPageProps> = async ({ 
  params
}) => {
  const totalRevenue = await getTotalRevenue(params.storeId);
  const graphRevenue = await getGraphRevenue(params.storeId);
  const salesCount = await getSalesCount(params.storeId);
  const stockCount = await getStockCount(params.storeId);
  const deliveryFeesTotal = await getDeliveryFeesTotal(params.storeId);

  return (
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-4 pt-4 sm:p-6 sm:pt-6 lg:p-8 lg:pt-6">
        <Heading title="Dashboard" description="Overview of your store" />
        <Separator />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="min-w-0">
            <CardHeader className="flex min-w-0 flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="min-w-0 break-words text-sm font-medium">
                Total Revenue
              </CardTitle>
              <Banknote className="h-4 w-4 shrink-0 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="min-w-0 break-words text-2xl font-bold [overflow-wrap:anywhere]">
                {formatter.format(totalRevenue)}
              </div>
            </CardContent>
          </Card>
          <Card className="min-w-0">
            <CardHeader className="flex min-w-0 flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="min-w-0 break-words text-sm font-medium">Sales</CardTitle>
              <CreditCard className="h-4 w-4 shrink-0 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="min-w-0 break-words text-2xl font-bold [overflow-wrap:anywhere]">
                +{salesCount}
              </div>
            </CardContent>
          </Card>
          <Card className="min-w-0">
            <CardHeader className="flex min-w-0 flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="min-w-0 break-words text-sm font-medium">
                Products In Stock
              </CardTitle>
              <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="min-w-0 break-words text-2xl font-bold [overflow-wrap:anywhere]">
                {stockCount}
              </div>
            </CardContent>
          </Card>
          <Card className="min-w-0">
            <CardHeader className="flex min-w-0 flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="min-w-0 break-words text-sm font-medium">
                Delivery fees collected
              </CardTitle>
              <Truck className="h-4 w-4 shrink-0 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="min-w-0 break-words text-2xl font-bold [overflow-wrap:anywhere]">
                {formatter.format(deliveryFeesTotal)}
              </div>
              <p className="text-xs text-muted-foreground">Confirmed and delivered orders; included in revenue.</p>
            </CardContent>
          </Card>
        </div>
        <Card className="col-span-4 min-w-0">
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <Overview data={graphRevenue} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;
