// Cities for delivery settings and checkout. Byte-identical in Admin and
// Storefront: change both together. Keys are stable (stored in
// StoreDeliveryCity.cityKey); names are for display only.

export type CityOption = { key: string; name: string };

// The 12 main cities, in display order.
export const PAKISTAN_CITIES: readonly CityOption[] = [
  { key: "karachi", name: "Karachi" },
  { key: "lahore", name: "Lahore" },
  { key: "islamabad", name: "Islamabad" },
  { key: "rawalpindi", name: "Rawalpindi" },
  { key: "faisalabad", name: "Faisalabad" },
  { key: "multan", name: "Multan" },
  { key: "peshawar", name: "Peshawar" },
  { key: "quetta", name: "Quetta" },
  { key: "sialkot", name: "Sialkot" },
  { key: "gujranwala", name: "Gujranwala" },
  { key: "hyderabad", name: "Hyderabad" },
  { key: "bahawalpur", name: "Bahawalpur" },
];

// Any city not in the list. Always uses the Store's default delivery fee.
export const OTHER_CITY: CityOption = { key: "other", name: "Other city" };

// True for one of the 12 main city keys (not "other").
export const isCityKey = (value: unknown): value is string =>
  typeof value === "string" && PAKISTAN_CITIES.some((city) => city.key === value);

// Display name for a city key ("other" included); null for an unknown key.
export function cityName(key: string): string | null {
  if (key === OTHER_CITY.key) return OTHER_CITY.name;

  return PAKISTAN_CITIES.find((city) => city.key === key)?.name ?? null;
}
