export interface SiteIndexingEnvironment {
  readonly SITE_INDEXING?: string | undefined;
  readonly SITE_ORIGIN?: string | undefined;
}

export interface SiteIndexingConfig {
  readonly indexingEnabled: boolean;
  readonly siteOrigin: string | null;
  readonly robotsDirective: "index,follow" | "noindex,nofollow";
}

/**
 * P8.3 ships the sitemap integration and positive indexed-build verification,
 * so production indexing may now pass the readiness gate when explicitly enabled
 * with a valid HTTPS origin. Preview/non-final builds remain disabled by default.
 */
export const PRODUCTION_INDEXING_ARTIFACTS_READY = true;

const disabledConfig: SiteIndexingConfig = {
  indexingEnabled: false,
  siteOrigin: null,
  robotsDirective: "noindex,nofollow",
};

export function resolveSiteIndexingConfig(
  env: SiteIndexingEnvironment,
  indexingArtifactsReady = PRODUCTION_INDEXING_ARTIFACTS_READY,
): SiteIndexingConfig {
  if (env.SITE_INDEXING !== "enabled") {
    return disabledConfig;
  }

  if (!indexingArtifactsReady) {
    throw new Error(
      "SITE_INDEXING=enabled is blocked until the production sitemap/indexing artifacts are ready.",
    );
  }

  const rawOrigin = env.SITE_ORIGIN?.trim();
  if (!rawOrigin) {
    throw new Error("SITE_ORIGIN is required when SITE_INDEXING=enabled.");
  }

  return enabledConfigFromOrigin(rawOrigin);
}

/**
 * Runtime pages consume Astro's resolved `site` config rather than reading env
 * again. This keeps sitemap activation, canonical metadata and robots output on
 * one config-time decision path.
 */
export function resolveSiteIndexingConfigFromSite(
  site: URL | null | undefined,
): SiteIndexingConfig {
  if (!site) {
    return disabledConfig;
  }

  return enabledConfigFromOrigin(site.href);
}

export function buildCanonicalUrl(
  config: SiteIndexingConfig,
  pathname: string,
): string | null {
  if (!config.indexingEnabled || !config.siteOrigin) {
    return null;
  }

  const canonical = new URL(config.siteOrigin);
  canonical.pathname = normalizePathname(pathname);
  return canonical.href;
}

export function buildRobotsTxt(config: SiteIndexingConfig): string {
  const lines = ["User-agent: *", "Allow: /"];

  if (config.indexingEnabled && config.siteOrigin) {
    lines.push(`Sitemap: ${config.siteOrigin}/sitemap-index.xml`);
  }

  return `${lines.join("\n")}\n`;
}

function enabledConfigFromOrigin(rawOrigin: string): SiteIndexingConfig {
  let origin: URL;
  try {
    origin = new URL(rawOrigin);
  } catch {
    throw new Error("SITE_ORIGIN must be a valid absolute HTTPS origin.");
  }

  if (origin.protocol !== "https:") {
    throw new Error("SITE_ORIGIN must use https:// when SITE_INDEXING=enabled.");
  }

  if (!origin.hostname) {
    throw new Error("SITE_ORIGIN must include a hostname.");
  }

  if (
    origin.pathname !== "/" ||
    origin.search !== "" ||
    origin.hash !== "" ||
    origin.username !== "" ||
    origin.password !== ""
  ) {
    throw new Error(
      "SITE_ORIGIN must be an origin only, without credentials, path, query, or hash.",
    );
  }

  return {
    indexingEnabled: true,
    siteOrigin: origin.origin,
    robotsDirective: "index,follow",
  };
}

function normalizePathname(pathname: string): string {
  const trimmed = pathname.trim();
  if (!trimmed) return "/";

  const rooted = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return rooted.replace(/\/index\.html$/, "/");
}
