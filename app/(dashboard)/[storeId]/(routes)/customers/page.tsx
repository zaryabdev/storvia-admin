import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs";

import { loadStoreCustomers } from "@/lib/customers-data";
import prismadb from "@/lib/prismadb";

import { CustomerClient } from "./components/client";

const CustomersPage = async ({ params }: { params: { storeId: string } }) => {
    const { userId } = auth();

    if (!userId) {
        redirect("/sign-in");
    }

    // loadStoreCustomers does no ownership check, so it happens here first.
    // id only: Store has Decimal columns that can't reach Client Components.
    const store = await prismadb.store.findFirst({
        where: { id: params.storeId, userId },
        select: { id: true },
    });

    if (!store) {
        redirect("/");
    }

    const customers = await loadStoreCustomers(store.id);

    return (
        <div className="flex-col">
            <div className="flex-1 p-4 pt-4 sm:p-6 sm:pt-6 lg:p-8 lg:pt-6 space-y-4">
                <CustomerClient data={customers} />
            </div>
        </div>
    );
};

export default CustomersPage;
