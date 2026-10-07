import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs";

import { deliverySettingsFromStore, toMerchantDeliveryBody } from "@/lib/delivery";
import { SAMPLE_ORDER, type OrderTemplateData } from "@/lib/order-template";
import prismadb from "@/lib/prismadb";

import { SettingsForm } from "./components/settings-form";
import { ThemeSection } from "./components/theme-section";
import { BillingForm } from "./components/billing-form";
import { EmailDeliverySection } from "./components/email-delivery-section";
import { WhatsAppTemplatesSection } from "./components/whatsapp-templates-section";
import { SenderDetailsSection } from "./components/sender-details-section";
import { PackingSlipSection } from "./components/packing-slip-section";
import { DeliverySection } from "./components/delivery-section";
import { SettingsTabs } from "./components/settings-tabs";
import { parseSettingsTab } from "./components/settings-tab-keys";

const SettingsPage = async ({
  params,
  searchParams
}: {
  params: { storeId: string }
  searchParams: { tab?: string | string[] }
}) => {
  const { userId } = auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const store = await prismadb.store.findFirst({
    where: {
      id: params.storeId,
      userId
    },
    include: {
      deliveryCities: { select: { cityKey: true, fee: true } },
    },
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

  // Each section renders exactly once, in its tab (?tab= decides which shows
  // first; every panel stays mounted so unsaved edits survive tab switches).
  const panels = {
    store: (
      <>
        <SettingsForm
          initialData={{ name: store.name, logoUrl: store.logoUrl, faviconUrl: store.faviconUrl }}
        />
        <div className="border-t pt-8">
          <ThemeSection />
        </div>
      </>
    ),
    delivery: (
      <>
        <DeliverySection
          storeId={store.id}
          initialSettings={toMerchantDeliveryBody(deliverySettingsFromStore(store, store.deliveryCities))}
        />
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
      </>
    ),
    messages: (
      <>
        <WhatsAppTemplatesSection
          storeId={store.id}
          sample={sample}
          initialConfirmTemplate={store.whatsappConfirmTemplate}
          initialMessageTemplate={store.whatsappMessageTemplate}
        />
        <div className="border-t pt-8">
          <EmailDeliverySection
            storeId={store.id}
            initialBlocked={store.emailDeliveryBlocked}
          />
        </div>
      </>
    ),
    "packing-slips": (
      <PackingSlipSection
        storeId={store.id}
        sample={sample}
        initialPaperSize={store.slipPaperSize}
        initialHeaderTemplate={store.slipHeaderTemplate}
        initialFooterTemplate={store.slipFooterTemplate}
      />
    ),
    billing: <BillingForm />,
  };

  return (
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-4 pt-4 sm:p-6 sm:pt-6 lg:p-8 lg:pt-6">
        <SettingsTabs
          initialTab={parseSettingsTab(Array.isArray(searchParams.tab) ? searchParams.tab[0] : searchParams.tab)}
          panels={panels}
        />
      </div>
    </div>
  );
}

export default SettingsPage;
