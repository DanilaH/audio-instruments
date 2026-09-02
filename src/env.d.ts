/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly SITE_ANALYTICS?: string;
  readonly ANALYTICS_PRIVACY_REVIEW?: string;
  readonly CLOUDFLARE_WEB_ANALYTICS_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "@phosphor-icons/web/regular";
