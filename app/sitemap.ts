import type { MetadataRoute } from "next";
import { SPACES } from "@/lib/spaces";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/event-spaces", "/availability", "/plan-your-event", "/book", "/packages", "/enhancements", "/team-building", "/accommodations", "/gallery", "/es"];
  return [
    ...pages.map((p) => ({ url: `${SITE_URL}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.7 })),
    ...SPACES.map((s) => ({ url: `${SITE_URL}/event-spaces/${s.id}`, changeFrequency: "monthly" as const, priority: 0.8 })),
  ];
}
