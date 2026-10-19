import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs";

import prismadb from "@/lib/prismadb";
import { deliverySettingsFromStore, formatDeliveryDays } from "@/lib/delivery";
import { isBankTransferAvailable } from "@/lib/payment-accounts";
import { loadPublicPaymentAccounts } from "@/lib/payment-settings";

import { NewOrderForm, type NewOrderProduct } from "./components/new-order-form";

// "New order": the merchant creates an order by hand (POST /api/:storeId/orders).
// Only plain values reach the client: Store has Decimal columns, so prices and
// delivery settings are passed as decimal strings.
const NewOrderPage = async ({ params }: { params: { storeId: string } }) => {
    const { userId } = auth();

    if (!userId) {
        redirect("/sign-in");
    }

    const store = await prismadb.store.findFirst({
        where: { id: params.storeId, userId },
        select: {
            id: true,
            name: true,
            deliveryArea: true,
            deliveryFee: true,
            freeDeliveryThreshold: true,
            deliveryDaysMin: true,
            deliveryDaysMax: true,
            deliveryCities: { select: { cityKey: true, fee: true } },
            bankTransferEnabled: true,
            whatsappConfirmTemplate: true,
            whatsappMessageTemplate: true,
            senderName: true,
            senderPhone: true,
            senderAddress: true,
            senderCity: true,
            // Blocked numbers: a warning under the phone field only.
            blockedPhones: { select: { phoneKey: true } },
        },
    });

    if (!store) {
        redirect("/");
    }

    const [paymentAccounts, productRows] = await Promise.all([
        // {bank_details} in the WhatsApp message, and whether bank transfer is offered.
        loadPublicPaymentAccounts(store.id),
        prismadb.product.findMany({
            where: { storeId: store.id, isArchived: false },
            orderBy: [{ name: "asc" }, { createdAt: "asc" }],
            select: {
                id: true,
                name: true,
                price: true,
                quantity: true,
                size: { select: { value: true } },
                color: { select: { name: true } },
            },
        }),
    ]);

    const products: NewOrderProduct[] = productRows.map((product) => ({
        id: product.id,
        name: product.name,
        price: product.price.toFixed(),
        quantity: product.quantity,
        size: product.size?.value ?? null,
        color: product.color?.name ?? null,
    }));

    return (
        <div className="flex-col">
            <div className="flex-1 p-4 pt-4 sm:p-6 sm:pt-6 lg:p-8 lg:pt-6 space-y-4">
                <NewOrderForm
                    storeId={store.id}
                    products={products}
                    delivery={deliverySettingsFromStore(store, store.deliveryCities)}
                    blockedPhoneKeys={store.blockedPhones.map((row) => row.phoneKey)}
                    bankTransferAvailable={isBankTransferAvailable(
                        store.bankTransferEnabled,
                        paymentAccounts.length,
                    )}
                    whatsapp={{
                        storeName: store.name,
                        confirmTemplate: store.whatsappConfirmTemplate,
                        messageTemplate: store.whatsappMessageTemplate,
                        deliveryDays: formatDeliveryDays(store.deliveryDaysMin, store.deliveryDaysMax),
                        senderName: store.senderName,
                        senderPhone: store.senderPhone,
                        senderAddress: store.senderAddress,
                        senderCity: store.senderCity,
                        paymentAccounts,
                    }}
                />
            </div>
        </div>
    );
};

export default NewOrderPage;
