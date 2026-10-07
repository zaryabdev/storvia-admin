import type { MetadataRoute } from "next";

// Web App Manifest (served at /manifest.webmanifest, public). The merchant
// dashboard is installable; there is no data caching (see public/sw.js).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Storvia Admin",
    short_name: "Storvia",
    description: "Storvia merchant administration",
    start_url: "/",
    scope: "/",
    display: "standalone",
    theme_color: "#0f766e",
    background_color: "#ffffff",
    icons: [
      { src: "/brand/storvia-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/storvia-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/storvia-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
