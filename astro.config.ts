import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";

import { resolveSiteIndexingConfig } from "./src/config/site-indexing";

const indexing = resolveSiteIndexingConfig({
  SITE_INDEXING: process.env.SITE_INDEXING,
  SITE_ORIGIN: process.env.SITE_ORIGIN,
});

export default defineConfig({
  output: "static",
  ...(indexing.indexingEnabled && indexing.siteOrigin
    ? {
        site: indexing.siteOrigin,
        integrations: [sitemap()],
      }
    : {
        integrations: [],
      }),
});
