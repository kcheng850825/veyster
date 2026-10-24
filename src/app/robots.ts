import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

// Served at /robots.txt. Public pages are crawlable; authenticated app areas
// and unlisted survey links (/s/...) are not.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/feed",
          "/answered",
          "/profile",
          "/onboarding",
          "/surveys",
          "/admin",
          "/s/",
          "/logout",
          "/setup-required",
        ],
      },
    ],
    sitemap: `${BRAND.url}/sitemap.xml`,
  };
}
