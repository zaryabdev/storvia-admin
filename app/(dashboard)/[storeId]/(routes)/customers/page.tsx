import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs";

import { loadStoreCustomers } from "@/lib/customers-data";
import { formatDate } from "@/lib/order-template";
import prismadb from "@/lib/prismadb";

import { CustomerClient } from "./components/client";

const CustomersPage = async ({ params }: { params: { storeId: string } }) => {
    const { userId } = auth();

    if (!userId) {
        redirect("/sign-in");
    }

    // loadStoreCustomers does no ownership check, so it happens here first.
    // No full row: Store has Decimal columns that can't reach Client Components.
    // The blocklist feeds the "Blocked" badges and the Blocked numbers list.
    const store = await prismadb.store.findFirst({
        where: { id: params.storeId, userId },
        select: {
            id: true,
            blockedPhones: {
                orderBy: [{ createdAt: "desc" }, { id: "desc" }],
                select: { id: true, phoneKey: true, phone: true, note: true, createdAt: true },
            },
        },
    });

    if (!store) {
        redirect("/");
    }

    const customers = await loadStoreCustomers(
        store.id,
        new Map(store.blockedPhones.map((row) => [row.phoneKey, row.id])),
    );
    const blockedNumbers = store.blockedPhones.map((row) => ({
        id: row.id,
        phone: row.phone,
        note: row.note,
        date: formatDate(row.createdAt),
    }));

    return (
        <div className="flex-col">
            <div className="flex-1 p-4 pt-4 sm:p-6 sm:pt-6 lg:p-8 lg:pt-6 space-y-4">
                <CustomerClient data={customers} blockedNumbers={blockedNumbers} />
            </div>
        </div>
    );
};

export default CustomersPage;
