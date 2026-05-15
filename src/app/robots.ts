import type { MetadataRoute } from "next";
import { absoluteUrl, siteConfig } from "@/lib/seo";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    host: siteConfig.url,
    sitemap: absoluteUrl("/sitemap.xml"),
    rules: [
      {
        userAgent: "*",
        allow: "/",
      },
    ],
  };
}
