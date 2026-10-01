import { createServerFn } from "@tanstack/react-start";

import { FALLBACK_SITE_DATA, type SiteData } from "./site-data";
import { loadSiteData } from "./site-data.server";

/**
 * Everything owner-editable that the public pages show, read once by the root loader.
 * If D1 is unreachable (or not configured, as in `vite dev`) the site renders the
 * content it shipped with and never breaks.
 */
export const getSiteData = createServerFn({ method: "GET" }).handler(
  async (): Promise<SiteData> => {
    try {
      return await loadSiteData();
    } catch (error) {
      console.error("Site data unavailable, using the shipped content:", error);
      return FALLBACK_SITE_DATA;
    }
  },
);
