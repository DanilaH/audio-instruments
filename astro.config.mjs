import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";

const indexingEnabled = process.env.SITE_INDEXING === "enabled";
const siteOrigin = process.env.SITE_ORIGIN?.trim();

export default defineConfig({
  output: "static",
  ...(indexingEnabled && siteOrigin ? { site: siteOrigin } : {}),
  integrations: indexingEnabled ? [sitemap()] : [],
});
