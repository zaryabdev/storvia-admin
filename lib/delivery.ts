// Delivery charges: settings validation, the cities a customer may choose and
// the fee for an order. Pure functions, no React or database access, shared by
// the merchant/public routes and the Settings form (client-side validation).
// Money is Decimal end to end and crosses the API as plain decimal strings.

import { Prisma } from "@prisma/client";

import { PAKISTAN_CITIES, OTHER_CITY, cityName, isCityKey } from "./pakistan-cities";

// Same configuration as PreciseDecimal (lib/decimal.ts), built from Prisma's
// browser-safe Decimal export so the Settings form can run these rules too.
// On the server this is the same decimal.js class Prisma returns.
const Money = Prisma.Decimal.clone({ precision: 100 });
type MoneyValue = InstanceType<typeof Money>;

export const DELIVERY_AREAS = ["ALL_PAKISTAN", "SELECTED_CITIES"] as const;
export type DeliveryAreaValue = (typeof DELIVERY_AREAS)[number];

export const MAX_DELIVERY_FEE = "100000";
export const MAX_FREE_DELIVERY_THRESHOLD = "10000000";
export const MAX_DELIVERY_DAYS = 30;

// What a Store stores (and what every function here reads).
export interface DeliverySettings {
  area: DeliveryAreaValue;
  /** PKR, >= 0; "0" = free delivery. */
  defaultFee: string;
  /** PKR, > 0, compared against the items subtotal; null = none. */
  freeDeliveryThreshold: string | null;
  daysMin: number;
  daysMax: number;
  /**
   * StoreDeliveryCity rows, in list order, never "other".
   * SELECTED_CITIES: the served cities; ALL_PAKISTAN: only fee overrides.
   * `fee` null = the default fee.
   */
  cities: Array<{ key: string; fee: string | null }>;
}

// New and existing Stores (the column defaults).
export const DEFAULT_DELIVERY_SETTINGS: DeliverySettings = {
  area: "ALL_PAKISTAN",
  defaultFee: "0",
  freeDeliveryThreshold: null,
  daysMin: 2,
  daysMax: 3,
  cities: [],
};

export const isDeliveryArea = (value: unknown): value is DeliveryAreaValue =>
  typeof value === "string" && (DELIVERY_AREAS as readonly string[]).includes(value);

const DECIMAL_PATTERN = /^\d+(\.\d+)?$/;
const MAX_FEE_LABEL = "Rs 100,000";
const MAX_THRESHOLD_LABEL = "Rs 10,000,000";

// A JSON number or plain decimal string (no sign, no exponent), else null.
// Blank / null / undefined is reported separately as "empty".
function parseMoney(raw: unknown): MoneyValue | "empty" | null {
  if (raw === undefined || raw === null) return "empty";

  const text =
    typeof raw === "number" && Number.isFinite(raw)
      ? String(raw)
      : typeof raw === "string"
        ? raw.trim()
        : null;

  if (text === "") return "empty";
  if (text === null || !DECIMAL_PATTERN.test(text)) return null;

  return new Money(text);
}

// A whole number of days, from a JSON number or a digit string; else null.
function parseDays(raw: unknown): number | null {
  const value =
    typeof raw === "number" ? raw : typeof raw === "string" && /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : NaN;

  return Number.isInteger(value) && value >= 0 && value <= MAX_DELIVERY_DAYS ? value : null;
}

// A city fee override: blank = none (null), otherwise 0 to 100,000.
function parseFee(raw: unknown, label: string): { error: string } | { value: MoneyValue | null } {
  const fee = parseMoney(raw);

  if (fee === "empty") return { value: null };
  if (fee === null) return { error: `${label} must be a number of 0 or more` };
  if (fee.greaterThan(MAX_DELIVERY_FEE)) return { error: `${label} must be at most ${MAX_FEE_LABEL}` };

  return { value: fee };
}

// Validates and normalizes a settings request body:
// { area, defaultFee, freeDeliveryThreshold, daysMin, daysMax,
//   cities: [{ key, selected, fee }] } (cities may list any of the 12).
// Returns the first problem as a plain message, or the settings to store.
export function normalizeDeliverySettings(input: unknown): { error: string } | { value: DeliverySettings } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { error: "Invalid request body" };
  }

  const body = input as Record<string, unknown>;

  if (!isDeliveryArea(body.area)) {
    return { error: "Delivery area must be ALL_PAKISTAN or SELECTED_CITIES" };
  }

  const defaultFee = parseMoney(body.defaultFee);
  if (defaultFee === "empty") return { error: "Delivery fee is required (0 for free delivery)" };
  if (defaultFee === null) return { error: "Delivery fee must be a number of 0 or more" };
  if (defaultFee.greaterThan(MAX_DELIVERY_FEE)) {
    return { error: `Delivery fee must be at most ${MAX_FEE_LABEL}` };
  }

  const threshold = parseMoney(body.freeDeliveryThreshold);
  if (threshold === null) return { error: "Free delivery amount must be a number" };
  if (threshold !== "empty") {
    if (!threshold.greaterThan(0)) return { error: "Free delivery amount must be more than 0" };
    if (threshold.greaterThan(MAX_FREE_DELIVERY_THRESHOLD)) {
      return { error: `Free delivery amount must be at most ${MAX_THRESHOLD_LABEL}` };
    }
  }

  const daysMin = parseDays(body.daysMin);
  if (daysMin === null) return { error: `Minimum delivery days must be a whole number from 0 to ${MAX_DELIVERY_DAYS}` };
  const daysMax = parseDays(body.daysMax);
  if (daysMax === null) return { error: `Maximum delivery days must be a whole number from 0 to ${MAX_DELIVERY_DAYS}` };
  if (daysMin > daysMax) return { error: "Minimum delivery days can't be more than the maximum" };

  const rawCities = body.cities === undefined || body.cities === null ? [] : body.cities;
  if (!Array.isArray(rawCities)) return { error: "Cities must be a list" };

  const byKey = new Map<string, { selected: boolean; fee: unknown }>();

  for (const entry of rawCities) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return { error: "Invalid city entry" };

    const { key, selected, fee } = entry as Record<string, unknown>;

    if (key === OTHER_CITY.key) {
      return { error: "Other city can't be selected or given its own fee; it always uses the default fee" };
    }
    if (!isCityKey(key)) return { error: `Unknown city: ${String(key)}` };
    if (byKey.has(key)) return { error: `${cityName(key)} is listed twice` };
    if (selected !== undefined && typeof selected !== "boolean") return { error: `Invalid selection for ${cityName(key)}` };

    byKey.set(key, { selected: selected === true, fee });
  }

  const cities: DeliverySettings["cities"] = [];

  // List order; only the rows that mean something in this mode are kept.
  for (const { key, name } of PAKISTAN_CITIES) {
    const entry = byKey.get(key);
    if (!entry) continue;
    if (body.area === "SELECTED_CITIES" && !entry.selected) continue;

    const fee = parseFee(entry.fee, `Delivery fee for ${name}`);
    if ("error" in fee) return fee;

    // An override equal to the default is no override.
    const override = fee.value && !fee.value.equals(defaultFee) ? fee.value.toFixed() : null;

    if (body.area === "SELECTED_CITIES" || override !== null) {
      cities.push({ key, fee: override });
    }
  }

  if (body.area === "SELECTED_CITIES" && cities.length === 0) {
    return { error: "Select at least one city, or choose All of Pakistan" };
  }

  return {
    value: {
      area: body.area,
      defaultFee: defaultFee.toFixed(),
      freeDeliveryThreshold: threshold === "empty" ? null : threshold.toFixed(),
      daysMin,
      daysMax,
      cities,
    },
  };
}

export interface DeliveryOptions {
  /** The main cities a customer may choose, with each one's fee (before any free-delivery threshold). */
  cities: Array<{ key: string; name: string; fee: string }>;
  /** True when "Other city" (default fee) may be chosen. */
  otherCityAllowed: boolean;
  /** The only selectable city, when exactly one is selected (the Storefront locks it). */
  lockedCityKey: string | null;
}

export function getDeliveryOptions(settings: DeliverySettings): DeliveryOptions {
  const rows = new Map(settings.cities.map((city) => [city.key, city.fee]));
  const defaultFee = new Money(settings.defaultFee).toFixed();
  const served =
    settings.area === "ALL_PAKISTAN" ? PAKISTAN_CITIES : PAKISTAN_CITIES.filter((city) => rows.has(city.key));

  const cities = served.map(({ key, name }) => {
    const override = rows.get(key);

    return { key, name, fee: override != null ? new Money(override).toFixed() : defaultFee };
  });

  return {
    cities,
    otherCityAllowed: settings.area === "ALL_PAKISTAN",
    lockedCityKey: settings.area === "SELECTED_CITIES" && cities.length === 1 ? cities[0].key : null,
  };
}

// The delivery fee for an order, as a decimal string, or null when the city
// isn't served. A set threshold makes delivery free when the items subtotal
// reaches it (equal counts). "other" always uses the default fee.
export function resolveDeliveryFee(
  settings: DeliverySettings,
  cityKey: string,
  itemsSubtotal: string | number | MoneyValue,
): string | null {
  const options = getDeliveryOptions(settings);
  const fee =
    cityKey === OTHER_CITY.key
      ? options.otherCityAllowed
        ? new Money(settings.defaultFee).toFixed()
        : null
      : options.cities.find((city) => city.key === cityKey)?.fee ?? null;

  if (fee === null) return null;

  if (
    settings.freeDeliveryThreshold !== null &&
    new Money(itemsSubtotal).greaterThanOrEqualTo(settings.freeDeliveryThreshold)
  ) {
    return "0";
  }

  return fee;
}

// The checkout city for an order, or null when no served city matches.
// A valid `cityKey` ("other" included) is used as is. Without one (older
// Storefront payloads that only send the city text), the text is matched
// case-insensitively against the city names; anything else becomes "other"
// when Other city is allowed. The key must be served by the settings.
export function resolveDeliveryCity(
  settings: DeliverySettings,
  { cityKey, city }: { cityKey?: unknown; city?: unknown },
): string | null {
  const options = getDeliveryOptions(settings);
  const served = (key: string) =>
    key === OTHER_CITY.key ? options.otherCityAllowed : options.cities.some((c) => c.key === key);

  if (typeof cityKey === "string" && (cityKey === OTHER_CITY.key || isCityKey(cityKey))) {
    return served(cityKey) ? cityKey : null;
  }

  const text = typeof city === "string" ? city.trim().toLowerCase() : "";
  const match = PAKISTAN_CITIES.find((c) => c.name.toLowerCase() === text)?.key;

  if (match) return served(match) ? match : null;
  if (text === OTHER_CITY.name.toLowerCase()) return served(OTHER_CITY.key) ? OTHER_CITY.key : null;

  return options.otherCityAllowed ? OTHER_CITY.key : null;
}

// "2–3" (en dash), or "2" when both are equal.
export const formatDeliveryDays = (min: number, max: number): string =>
  min === max ? String(min) : `${min}–${max}`;

// Builds settings from the Store columns + StoreDeliveryCity rows (Prisma
// Decimals or strings), dropping rows that don't apply.
export function deliverySettingsFromStore(
  store: {
    deliveryArea: string;
    deliveryFee: { toString(): string } | string;
    freeDeliveryThreshold: { toString(): string } | string | null;
    deliveryDaysMin: number;
    deliveryDaysMax: number;
  },
  rows: Array<{ cityKey: string; fee: { toString(): string } | string | null }>,
): DeliverySettings {
  const byKey = new Map(rows.map((row) => [row.cityKey, row.fee]));
  const area = isDeliveryArea(store.deliveryArea) ? store.deliveryArea : "ALL_PAKISTAN";

  return {
    area,
    defaultFee: new Money(store.deliveryFee.toString()).toFixed(),
    freeDeliveryThreshold:
      store.freeDeliveryThreshold === null ? null : new Money(store.freeDeliveryThreshold.toString()).toFixed(),
    daysMin: store.deliveryDaysMin,
    daysMax: store.deliveryDaysMax,
    cities: PAKISTAN_CITIES.filter((city) => byKey.has(city.key)).map((city) => {
      const fee = byKey.get(city.key);

      return { key: city.key, fee: fee == null ? null : new Money(fee.toString()).toFixed() };
    }),
  };
}

// The merchant API / Settings form shape: all 12 cities, with `selected`
// (Selected cities mode only) and the override fee or null.
export function toMerchantDeliveryBody(settings: DeliverySettings) {
  const rows = new Map(settings.cities.map((city) => [city.key, city.fee]));

  return {
    area: settings.area,
    defaultFee: settings.defaultFee,
    freeDeliveryThreshold: settings.freeDeliveryThreshold,
    daysMin: settings.daysMin,
    daysMax: settings.daysMax,
    cities: PAKISTAN_CITIES.map(({ key, name }) => ({
      key,
      name,
      selected: settings.area === "SELECTED_CITIES" && rows.has(key),
      fee: rows.get(key) ?? null,
    })),
  };
}

export type MerchantDeliveryBody = ReturnType<typeof toMerchantDeliveryBody>;
