"use client";

import { Plus } from "lucide-react";
import { useParams, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";

import { columns, OrderColumn } from "./columns";
import { OrderMobileRow } from "./mobile-list";

interface OrderClientProps {
    data: OrderColumn[];
}

export const OrderClient: React.FC<OrderClientProps> = ({ data }) => {
    const params = useParams();
    const router = useRouter();

    return (
        <>
            <div className="heading-action-row">
                <Heading
                    title={`Orders (${data.length})`}
                    description="Manage orders for your store"
                />
                <Button
                    onClick={() => router.push(`/${params.storeId}/orders/new`)}
                    className="min-h-[44px] sm:min-h-0"
                >
                    <Plus className="mr-2 h-4 w-4" aria-hidden="true" /> New order
                </Button>
            </div>
            <Separator />
            <DataTable
                searchKey="trackingId"
                columns={columns}
                data={data}
                mobileRow={(order) => <OrderMobileRow order={order} />}
            />
        </>
    );
};
