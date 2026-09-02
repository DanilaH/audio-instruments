export const CLOUDFLARE_WEB_ANALYTICS_SCRIPT_URL =
  "https://static.cloudflareinsights.com/beacon.min.js";

export interface SiteAnalyticsEnvironment {
  readonly SITE_ANALYTICS?: string | undefined;
  readonly ANALYTICS_PRIVACY_REVIEW?: string | undefined;
  readonly CLOUDFLARE_WEB_ANALYTICS_TOKEN?: string | undefined;
}

export interface SiteAnalyticsConfig {
  readonly enabled: boolean;
  readonly provider: "none" | "cloudflare-web-analytics";
  readonly cloudflareWebAnalyticsToken: string | null;
}

const disabledConfig: SiteAnalyticsConfig = {
  enabled: false,
  provider: "none",
  cloudflareWebAnalyticsToken: null,
};

/**
 * Analytics is deliberately fail-closed. Selecting a provider is not enough:
 * production activation also requires an explicit privacy/consent review marker
 * and the provider-issued site token. Preview/default builds remain disabled.
 */
export function resolveSiteAnalyticsConfig(
  env: SiteAnalyticsEnvironment,
): SiteAnalyticsConfig {
  const provider = env.SITE_ANALYTICS?.trim();

  if (!provider || provider === "disabled") {
    return disabledConfig;
  }

  if (provider !== "cloudflare-web-analytics") {
    throw new Error(
      `Unsupported SITE_ANALYTICS provider: ${provider}. Expected "cloudflare-web-analytics" or "disabled".`,
    );
  }

  if (env.ANALYTICS_PRIVACY_REVIEW !== "approved") {
    throw new Error(
      "ANALYTICS_PRIVACY_REVIEW=approved is required before Cloudflare Web Analytics can be enabled.",
    );
  }

  const token = env.CLOUDFLARE_WEB_ANALYTICS_TOKEN?.trim();
  if (!token) {
    throw new Error(
      "CLOUDFLARE_WEB_ANALYTICS_TOKEN is required when SITE_ANALYTICS=cloudflare-web-analytics.",
    );
  }

  if (token.length > 256 || /\s/.test(token)) {
    throw new Error(
      "CLOUDFLARE_WEB_ANALYTICS_TOKEN must be a non-whitespace token no longer than 256 characters.",
    );
  }

  return {
    enabled: true,
    provider: "cloudflare-web-analytics",
    cloudflareWebAnalyticsToken: token,
  };
}

export function buildCloudflareWebAnalyticsBeaconConfig(
  config: SiteAnalyticsConfig,
): string | null {
  if (
    !config.enabled ||
    config.provider !== "cloudflare-web-analytics" ||
    !config.cloudflareWebAnalyticsToken
  ) {
    return null;
  }

  return JSON.stringify({
    token: config.cloudflareWebAnalyticsToken,
    spa: false,
  });
}
