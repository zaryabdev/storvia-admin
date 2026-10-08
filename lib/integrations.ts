// Ad-pixel integrations (Meta Pixel, TikTok Pixel). Pure rules shared by the
// merchant route, the public Store GET and the Settings UI. No Prisma import.
//
// connected = id is set; active = connected AND enabled; paused = connected AND
// not enabled. A pixel id is public (Storefront) only while active.

export type IntegrationProviderKey = "meta" | "tiktok";

export type IntegrationProvider = {
  key: IntegrationProviderKey;
  name: string;
  fieldLabel: string;
  placeholder: string;
  /** Error message for an invalid id, or null when valid (input is trimmed first). */
  validate: (value: string) => string | null;
};

const META_ID = /^[0-9]{10,20}$/;
const TIKTOK_ID = /^[A-Za-z0-9]{15,30}$/;

export const INTEGRATION_PROVIDERS: readonly IntegrationProvider[] = [
  {
    key: "meta",
    name: "Meta Pixel",
    fieldLabel: "Meta Pixel ID",
    placeholder: "e.g. 123456789012345",
    validate: (value) =>
      META_ID.test(value.trim()) ? null : "Meta Pixel ID must be 10–20 digits",
  },
  {
    key: "tiktok",
    name: "TikTok Pixel",
    fieldLabel: "TikTok Pixel ID",
    placeholder: "e.g. C1A2B3C4D5E6F7G8H9I0",
    validate: (value) =>
      TIKTOK_ID.test(value.trim())
        ? null
        : "TikTok Pixel ID must be 15–30 letters and numbers",
  },
];

export const getIntegrationProvider = (key: unknown) =>
  INTEGRATION_PROVIDERS.find((provider) => provider.key === key);

// The Store columns behind each provider.
export const INTEGRATION_COLUMNS = {
  meta: { id: "metaPixelId", enabled: "metaPixelEnabled" },
  tiktok: { id: "tiktokPixelId", enabled: "tiktokPixelEnabled" },
} as const;

export type IntegrationColumns = {
  metaPixelId: string | null;
  metaPixelEnabled: boolean;
  tiktokPixelId: string | null;
  tiktokPixelEnabled: boolean;
};

export type IntegrationState = { pixelId: string | null; enabled: boolean };
export type IntegrationsBody = Record<IntegrationProviderKey, IntegrationState>;

export const isConnected = (state: IntegrationState) => state.pixelId !== null;
export const isActive = (state: IntegrationState) => state.pixelId !== null && state.enabled;
export const isPaused = (state: IntegrationState) => state.pixelId !== null && !state.enabled;

// The merchant GET/PATCH response shape (pixelId null = not connected).
export const toIntegrationsBody = (store: IntegrationColumns): IntegrationsBody => ({
  meta: { pixelId: store.metaPixelId, enabled: store.metaPixelEnabled },
  tiktok: { pixelId: store.tiktokPixelId, enabled: store.tiktokPixelEnabled },
});

// The ids the public Store GET exposes: each only while active, else null.
export function publicPixelIds(store: IntegrationColumns) {
  const body = toIntegrationsBody(store);
  return {
    metaPixelId: isActive(body.meta) ? body.meta.pixelId : null,
    tiktokPixelId: isActive(body.tiktok) ? body.tiktok.pixelId : null,
  };
}

// Validates a PATCH body { provider, pixelId?: string | null, enabled?: boolean }
// against the provider's current state, before any write. Returns the
// provider's next state or the plain-text 400 message.
//   pixelId: omitted = unchanged; string = validated, stored trimmed;
//            null = disconnect (id null, enabled back to true; `enabled` ignored).
//   enabled: omitted = unchanged (true when connecting); not on a provider
//            that stays disconnected.
export function parseIntegrationPatch(
  body: unknown,
  current: IntegrationsBody,
):
  | { value: { provider: IntegrationProviderKey; next: IntegrationState } }
  | { error: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { error: "Invalid request body" };
  }

  const raw = body as Record<string, unknown>;
  const provider = getIntegrationProvider(raw.provider);
  if (!provider) return { error: "Unknown integration" };

  const state = current[provider.key];

  if (raw.pixelId === null) {
    return { value: { provider: provider.key, next: { pixelId: null, enabled: true } } };
  }

  let pixelId = state.pixelId;
  if (raw.pixelId !== undefined) {
    if (typeof raw.pixelId !== "string") return { error: "Invalid request body" };
    const error = provider.validate(raw.pixelId);
    if (error) return { error };
    pixelId = raw.pixelId.trim();
  }

  if (raw.enabled !== undefined && typeof raw.enabled !== "boolean") {
    return { error: "Invalid request body" };
  }
  if (raw.enabled !== undefined && pixelId === null) {
    return { error: "Connect this integration first" };
  }

  const connecting = state.pixelId === null && pixelId !== null;
  const enabled =
    typeof raw.enabled === "boolean" ? raw.enabled : connecting ? true : state.enabled;

  return { value: { provider: provider.key, next: { pixelId, enabled } } };
}

// "••••" + the last 4 characters.
export const maskPixelId = (pixelId: string) => `••••${pixelId.slice(-4)}`;
