import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";

import { resolveSiteIndexingConfig } from "./src/config/site-indexing";

const indexing = resolveSiteIndexingConfig(process.env);

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
