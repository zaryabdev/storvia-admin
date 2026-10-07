import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({
  // The PWA files must be reachable signed out, or installation fails. (The
  // matcher below already skips paths with a dot; listed here to be explicit.)
  publicRoutes: ["/api/:path*", "/manifest.webmanifest", "/sw.js", "/offline.html", "/brand/(.*)"],
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
