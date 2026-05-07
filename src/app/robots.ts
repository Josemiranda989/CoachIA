import type { MetadataRoute } from "next";

// CoachIA is a private single-user app. Disallow all crawlers.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
