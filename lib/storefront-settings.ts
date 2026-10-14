// Storefront announcement bar and social links. Pure rules shared by the
// merchant route, the public Store GET and the Settings form. No Prisma import
// (usable client- and server-side).
//
// Announcement: plain text, public only while enabled and non-empty; turning it
// off keeps the text. Social links: the merchant types a handle or a profile
// link; we validate the handle and store a URL we rebuild ourselves, never the
// input as typed.

export const MAX_ANNOUNCEMENT_LENGTH = 120;
export const MAX_SOCIAL_INPUT_LENGTH = 200;

export const ANNOUNCEMENT_TOO_LONG_ERROR = `Announcement must be at most ${MAX_ANNOUNCEMENT_LENGTH} characters`;
export const ANNOUNCEMENT_EMPTY_ERROR = "Add the announcement text, or turn it off";
const ANNOUNCEMENT_CONTROL_ERROR = "Announcement can't contain control characters";
const INVALID_BODY_ERROR = "Invalid request body";

export type SocialNetwork = "instagram" | "tiktok" | "facebook";

export const SOCIAL_NETWORKS: readonly { key: SocialNetwork; label: string }[] = [
  { key: "instagram", label: "Instagram" },
  { key: "tiktok", label: "TikTok" },
  { key: "facebook", label: "Facebook" },
];

export const SOCIAL_LINK_ERRORS: Record<SocialNetwork, string> = {
  instagram: "Enter an Instagram username or profile link",
  tiktok: "Enter a TikTok username or profile link",
  facebook: "Enter a Facebook page or profile link",
};

// The merchant GET/PATCH response shape.
export type StorefrontSettings = {
  announcementText: string | null;
  announcementEnabled: boolean;
  instagram: string | null;
  tiktok: string | null;
  facebook: string | null;
};

// The Store columns behind it.
export type StorefrontColumns = {
  announcementText: string | null;
  announcementEnabled: boolean;
  instagramUrl: string | null;
  tiktokUrl: string | null;
  facebookUrl: string | null;
};

export const STOREFRONT_SETTINGS_SELECT = {
  announcementText: true,
  announcementEnabled: true,
  instagramUrl: true,
  tiktokUrl: true,
  facebookUrl: true,
} as const;

const SOCIAL_COLUMNS: Record<SocialNetwork, "instagramUrl" | "tiktokUrl" | "facebookUrl"> = {
  instagram: "instagramUrl",
  tiktok: "tiktokUrl",
  facebook: "facebookUrl",
};

export const toStorefrontSettings = (store: StorefrontColumns): StorefrontSettings => ({
  announcementText: store.announcementText,
  announcementEnabled: store.announcementEnabled,
  instagram: store.instagramUrl,
  tiktok: store.tiktokUrl,
  facebook: store.facebookUrl,
});

const toStorefrontColumns = (settings: StorefrontSettings): StorefrontColumns => ({
  announcementText: settings.announcementText,
  announcementEnabled: settings.announcementEnabled,
  instagramUrl: settings.instagram,
  tiktokUrl: settings.tiktok,
  facebookUrl: settings.facebook,
});

// C0, DEL and C1 control characters.
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/;

// Code points, not UTF-16 units: an emoji outside the BMP counts as one.
export const codePointLength = (text: string) => Array.from(text).length;

// Whitespace and newlines collapse to single spaces, then trimmed.
export const collapseAnnouncement = (text: string) => text.replace(/\s+/g, " ").trim();

// The announcement text: omitted → undefined (unchanged); null / blank → null.
export function parseAnnouncementText(raw: unknown): { value: string | null | undefined } | { error: string } {
  if (raw === undefined) return { value: undefined };
  if (raw === null) return { value: null };
  if (typeof raw !== "string") return { error: INVALID_BODY_ERROR };

  const text = collapseAnnouncement(raw);
  if (text === "") return { value: null };
  if (CONTROL_CHARS.test(text)) return { error: ANNOUNCEMENT_CONTROL_ERROR };
  if (codePointLength(text) > MAX_ANNOUNCEMENT_LENGTH) return { error: ANNOUNCEMENT_TOO_LONG_ERROR };

  return { value: text };
}

// ---------------------------------------------------------------------------
// Social links

const HOSTS: Record<SocialNetwork, readonly string[]> = {
  instagram: ["instagram.com", "www.instagram.com", "m.instagram.com", "instagr.am"],
  tiktok: ["tiktok.com", "www.tiktok.com", "m.tiktok.com"],
  facebook: [
    "facebook.com",
    "www.facebook.com",
    "m.facebook.com",
    "web.facebook.com",
    "mbasic.facebook.com",
    "fb.com",
    "www.fb.com",
  ],
};

// Any of these in the input means "this is a link", even without a "/".
// fb.me is listed so it is parsed (and rejected), not taken as a handle.
const KNOWN_DOMAINS = ["instagram.com", "instagr.am", "tiktok.com", "facebook.com", "fb.com", "fb.me"];

const INSTAGRAM_HANDLE = /^[A-Za-z0-9._]{1,30}$/;
const INSTAGRAM_RESERVED = ["p", "reel", "reels", "explore", "stories", "accounts", "direct", "tv", "share"];

const TIKTOK_HANDLE = /^[A-Za-z0-9._]{2,24}$/;

const FACEBOOK_NAME = /^[A-Za-z0-9.-]{5,80}$/;
const FACEBOOK_PEOPLE_NAME = /^[A-Za-z0-9.-]{1,80}$/;
const FACEBOOK_ID = /^\d{1,20}$/;
const FACEBOOK_RESERVED = [
  "sharer",
  "share",
  "login",
  "groups",
  "watch",
  "events",
  "marketplace",
  "dialog",
  "plugins",
  "help",
  "people",
  "pages",
  "profile.php",
];

type Parsed = { segments: string[]; query: URLSearchParams };

// The input as a URL on one of the network's hosts, or null. http is accepted
// (the stored URL is always https); userinfo, ports and any other host are not.
function parseProfileUrl(network: SocialNetwork, input: string): Parsed | null {
  const scheme = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(input);
  if (scheme && !/^https?$/i.test(scheme[1])) return null;

  const withScheme = scheme ? input : `https://${input}`;

  // Checked on the raw authority too: URL drops a default port (":443").
  const authority = /^[A-Za-z][A-Za-z0-9+.-]*:\/*([^/?#]*)/.exec(withScheme)?.[1] ?? "";
  if (authority.includes("@") || authority.includes(":")) return null;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password || url.port) return null;
  if (!HOSTS[network].includes(url.hostname.toLowerCase())) return null;

  return { segments: url.pathname.split("/").filter(Boolean), query: url.searchParams };
}

function instagramUrl(link: Parsed | null, handle: string | null): string | null {
  const name = link ? (link.segments.length === 1 ? link.segments[0] : null) : handle;
  if (!name || !INSTAGRAM_HANDLE.test(name)) return null;

  const lower = name.toLowerCase();
  if (INSTAGRAM_RESERVED.includes(lower)) return null;

  return `https://www.instagram.com/${lower}`;
}

function tiktokUrl(link: Parsed | null, handle: string | null): string | null {
  let name = handle;
  if (link) {
    // A profile link's path is "/@handle"; "/handle" and short links are not profiles.
    if (link.segments.length !== 1 || !link.segments[0].startsWith("@")) return null;
    name = link.segments[0].slice(1);
  }
  if (!name || !TIKTOK_HANDLE.test(name) || name.endsWith(".")) return null;

  return `https://www.tiktok.com/@${name.toLowerCase()}`;
}

function facebookUrl(link: Parsed | null, handle: string | null): string | null {
  const segments = link ? link.segments : handle ? [handle] : [];

  if (link && segments.length === 1 && segments[0].toLowerCase() === "profile.php") {
    const id = link.query.get("id");
    return id && FACEBOOK_ID.test(id) ? `https://www.facebook.com/profile.php?id=${id}` : null;
  }

  if (link && segments.length === 3 && segments[0].toLowerCase() === "people") {
    const [, name, id] = segments;
    return FACEBOOK_PEOPLE_NAME.test(name) && FACEBOOK_ID.test(id)
      ? `https://www.facebook.com/people/${name}/${id}`
      : null;
  }

  if (segments.length !== 1) return null;

  const name = segments[0];
  if (!FACEBOOK_NAME.test(name) || FACEBOOK_RESERVED.includes(name.toLowerCase())) return null;

  return `https://www.facebook.com/${name}`;
}

const BUILDERS: Record<SocialNetwork, (link: Parsed | null, handle: string | null) => string | null> = {
  instagram: instagramUrl,
  tiktok: tiktokUrl,
  facebook: facebookUrl,
};

// A handle or profile link → the canonical profile URL we store.
//   null / "" (after trim) → { url: null } (clears the link)
//   valid → { url } (rebuilt; query, hash and trailing slash dropped)
//   anything else → { error } (one message per network)
export function normalizeSocialLink(
  network: SocialNetwork,
  input: unknown,
): { url: string | null } | { error: string } {
  const error = { error: SOCIAL_LINK_ERRORS[network] };

  if (input === null || input === undefined) return { url: null };
  if (typeof input !== "string") return error;

  let value = input.trim();
  if (value === "") return { url: null };
  if (value.length > MAX_SOCIAL_INPUT_LENGTH) return error;
  if (/\s/.test(value) || CONTROL_CHARS.test(value) || value.includes("\\")) return error;
  if (value.startsWith("@")) value = value.slice(1);

  const lower = value.toLowerCase();
  const isLink = value.includes("/") || KNOWN_DOMAINS.some((domain) => lower.includes(domain));

  let link: Parsed | null = null;
  if (isLink) {
    link = parseProfileUrl(network, value);
    if (!link) return error;
  }

  const url = BUILDERS[network](link, isLink ? null : value);
  return url ? { url } : error;
}

// ---------------------------------------------------------------------------
// Merchant PATCH and public exposure

// Validates a merchant PATCH body against the current settings, before any
// write. Fields: announcementText, announcementEnabled, instagram, tiktok,
// facebook. Omitted = unchanged; null or "" clears; social fields take a
// handle or a link and become the canonical URL. Returns the next columns, or
// the first problem as plain text.
export function parseStorefrontSettingsPatch(
  body: unknown,
  current: StorefrontSettings,
): { value: StorefrontColumns } | { error: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { error: INVALID_BODY_ERROR };
  }

  const raw = body as Record<string, unknown>;
  const next = { ...current };

  const text = parseAnnouncementText(raw.announcementText);
  if ("error" in text) return text;
  if (text.value !== undefined) next.announcementText = text.value;

  if (raw.announcementEnabled !== undefined) {
    if (typeof raw.announcementEnabled !== "boolean") return { error: INVALID_BODY_ERROR };
    next.announcementEnabled = raw.announcementEnabled;
  }

  if (next.announcementEnabled && !next.announcementText) return { error: ANNOUNCEMENT_EMPTY_ERROR };

  for (const { key } of SOCIAL_NETWORKS) {
    if (raw[key] === undefined) continue;
    const link = normalizeSocialLink(key, raw[key]);
    if ("error" in link) return link;
    next[key] = link.url;
  }

  return { value: toStorefrontColumns(next) };
}

// The public Store GET `announcement`: the text only while enabled and non-empty.
export function publicAnnouncement(
  store: Pick<StorefrontColumns, "announcementText" | "announcementEnabled">,
): string | null {
  const text = store.announcementText?.trim();
  return store.announcementEnabled && text ? text : null;
}

// The public Store GET `socialLinks` (always an object). Stored values are
// re-checked, so only canonical profile URLs are ever public.
export function publicSocialLinks(
  store: Pick<StorefrontColumns, "instagramUrl" | "tiktokUrl" | "facebookUrl">,
): Record<SocialNetwork, string | null> {
  const canonical = (network: SocialNetwork) => {
    const link = normalizeSocialLink(network, store[SOCIAL_COLUMNS[network]]);
    return "url" in link ? link.url : null;
  };

  return { instagram: canonical("instagram"), tiktok: canonical("tiktok"), facebook: canonical("facebook") };
}
