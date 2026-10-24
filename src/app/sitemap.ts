import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

// Served at /sitemap.xml. Only the existing public, indexable pages: the
// landing page and sign-in. App routes are auth-gated and /s/... links are
// unlisted by design, so neither belongs here.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: BRAND.url,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BRAND.url}/login`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];
}
