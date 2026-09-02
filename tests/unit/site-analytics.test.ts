import { describe, expect, it } from "vitest";

import {
  buildCloudflareWebAnalyticsBeaconConfig,
  resolveSiteAnalyticsConfig,
} from "../../src/config/site-analytics";

describe("site analytics config", () => {
  it("is disabled by default", () => {
    expect(resolveSiteAnalyticsConfig({})).toEqual({
      enabled: false,
      provider: "none",
      cloudflareWebAnalyticsToken: null,
    });
  });

  it("supports an explicit disabled state without requiring provider credentials", () => {
    expect(
      resolveSiteAnalyticsConfig({
        SITE_ANALYTICS: "disabled",
        ANALYTICS_PRIVACY_REVIEW: "not-approved",
        CLOUDFLARE_WEB_ANALYTICS_TOKEN: "ignored",
      }),
    ).toEqual({
      enabled: false,
      provider: "none",
      cloudflareWebAnalyticsToken: null,
    });
  });

  it("rejects unknown providers instead of silently disabling them", () => {
    expect(() =>
      resolveSiteAnalyticsConfig({ SITE_ANALYTICS: "some-other-provider" }),
    ).toThrow(/Unsupported SITE_ANALYTICS provider/);
  });

  it("blocks Cloudflare activation until privacy review is explicitly approved", () => {
    expect(() =>
      resolveSiteAnalyticsConfig({
        SITE_ANALYTICS: "cloudflare-web-analytics",
        CLOUDFLARE_WEB_ANALYTICS_TOKEN: "0123456789abcdef",
      }),
    ).toThrow(/ANALYTICS_PRIVACY_REVIEW=approved/);
  });

  it("requires the Cloudflare site token after privacy review", () => {
    expect(() =>
      resolveSiteAnalyticsConfig({
        SITE_ANALYTICS: "cloudflare-web-analytics",
        ANALYTICS_PRIVACY_REVIEW: "approved",
      }),
    ).toThrow(/CLOUDFLARE_WEB_ANALYTICS_TOKEN is required/);
  });

  it("rejects malformed whitespace-bearing tokens", () => {
    expect(() =>
      resolveSiteAnalyticsConfig({
        SITE_ANALYTICS: "cloudflare-web-analytics",
        ANALYTICS_PRIVACY_REVIEW: "approved",
        CLOUDFLARE_WEB_ANALYTICS_TOKEN: "bad token",
      }),
    ).toThrow(/non-whitespace token/);
  });

  it("returns an explicit MPA beacon config when fully authorized", () => {
    const config = resolveSiteAnalyticsConfig({
      SITE_ANALYTICS: "cloudflare-web-analytics",
      ANALYTICS_PRIVACY_REVIEW: "approved",
      CLOUDFLARE_WEB_ANALYTICS_TOKEN: "0123456789abcdef",
    });

    expect(config).toEqual({
      enabled: true,
      provider: "cloudflare-web-analytics",
      cloudflareWebAnalyticsToken: "0123456789abcdef",
    });
    expect(buildCloudflareWebAnalyticsBeaconConfig(config)).toBe(
      '{"token":"0123456789abcdef","spa":false}',
    );
  });

  it("does not produce a beacon config when analytics is disabled", () => {
    expect(
      buildCloudflareWebAnalyticsBeaconConfig(resolveSiteAnalyticsConfig({})),
    ).toBeNull();
  });
});
