import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs";

import { SAMPLE_ORDER, type OrderTemplateData } from "@/lib/order-template";
import prismadb from "@/lib/prismadb";

import { SettingsForm } from "./components/settings-form";
import { ThemeSection } from "./components/theme-section";
import { BillingForm } from "./components/billing-form";
import { EmailDeliverySection } from "./components/email-delivery-section";
import { WhatsAppTemplatesSection } from "./components/whatsapp-templates-section";
import { SenderDetailsSection } from "./components/sender-details-section";
import { PackingSlipSection } from "./components/packing-slip-section";

const SettingsPage = async ({
  params
}: {
  params: { storeId: string }
}) => {
  const { userId } = auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const store = await prismadb.store.findFirst({
    where: {
      id: params.storeId,
      userId
    }
  });

  if (!store) {
    redirect('/');
  }

  // Template previews: the sample order with this Store's name and saved
  // sender details (sample values where a field is not set yet).
  const sample: OrderTemplateData = {
    ...SAMPLE_ORDER,
    storeName: store.name,
    senderName: store.senderName || SAMPLE_ORDER.senderName,
    senderPhone: store.senderPhone || SAMPLE_ORDER.senderPhone,
    senderAddress: store.senderAddress || SAMPLE_ORDER.senderAddress,
    senderCity: store.senderCity || SAMPLE_ORDER.senderCity,
  };

  return ( 
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-4 pt-4 sm:p-6 sm:pt-6 lg:p-8 lg:pt-6">
        <SettingsForm initialData={store} />
        <div className="border-t pt-8">
          <SenderDetailsSection
            storeId={store.id}
            initialDetails={{
              senderName: store.senderName,
              senderPhone: store.senderPhone,
              senderAddress: store.senderAddress,
              senderCity: store.senderCity,
            }}
          />
        </div>
        <div className="border-t pt-8">
          <ThemeSection />
        </div>
        <div className="border-t pt-8">
          <EmailDeliverySection
            storeId={store.id}
            initialBlocked={store.emailDeliveryBlocked}
          />
        </div>
        <div className="border-t pt-8">
          <WhatsAppTemplatesSection
            storeId={store.id}
            sample={sample}
            initialConfirmTemplate={store.whatsappConfirmTemplate}
            initialMessageTemplate={store.whatsappMessageTemplate}
          />
        </div>
        <div className="border-t pt-8">
          <PackingSlipSection
            storeId={store.id}
            sample={sample}
            initialPaperSize={store.slipPaperSize}
            initialHeaderTemplate={store.slipHeaderTemplate}
            initialFooterTemplate={store.slipFooterTemplate}
          />
        </div>
        <div className="border-t pt-8">
          <BillingForm />
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
