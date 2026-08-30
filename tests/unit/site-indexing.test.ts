import { describe, expect, it } from "vitest";
import {
  PRODUCTION_INDEXING_ARTIFACTS_READY,
  buildCanonicalUrl,
  buildRobotsTxt,
  resolveSiteIndexingConfig,
  resolveSiteIndexingConfigFromSite,
} from "../../src/config/site-indexing";

describe("site indexing gate", () => {
  it("keeps preview builds crawlable but non-indexable by default", () => {
    const config = resolveSiteIndexingConfig({});

    expect(config).toEqual({
      indexingEnabled: false,
      siteOrigin: null,
      robotsDirective: "noindex,nofollow",
    });
    expect(resolveSiteIndexingConfigFromSite(undefined)).toEqual(config);
    expect(buildCanonicalUrl(config, "/tone-generator")).toBeNull();
    expect(buildRobotsTxt(config)).toBe("User-agent: *\nAllow: /\n");
  });

  it("marks the production indexing artifacts ready after P8.3 sitemap integration", () => {
    expect(PRODUCTION_INDEXING_ARTIFACTS_READY).toBe(true);
  });

  it("still fails closed when readiness is explicitly unavailable", () => {
    expect(() =>
      resolveSiteIndexingConfig(
        {
          SITE_INDEXING: "enabled",
          SITE_ORIGIN: "https://example.com",
        },
        false,
      ),
    ).toThrow(/blocked until the production sitemap\/indexing artifacts are ready/i);
  });

  it.each([
    [undefined, /SITE_ORIGIN is required/],
    ["http://example.com", /must use https:\/\//],
    ["https://example.com/tools", /origin only/],
    ["https://example.com?source=test", /origin only/],
    ["https://example.com#top", /origin only/],
    ["https://user:pass@example.com", /origin only/],
    ["not a url", /valid absolute HTTPS origin/],
  ])("rejects invalid production origins: %s", (siteOrigin, expected) => {
    expect(() =>
      resolveSiteIndexingConfig({
        SITE_INDEXING: "enabled",
        ...(siteOrigin === undefined ? {} : { SITE_ORIGIN: siteOrigin }),
      }),
    ).toThrow(expected);
  });

  it("builds canonical and robots output only for a valid enabled origin", () => {
    const config = resolveSiteIndexingConfig({
      SITE_INDEXING: "enabled",
      SITE_ORIGIN: "https://Audio.Example.com/",
    });

    expect(config).toEqual({
      indexingEnabled: true,
      siteOrigin: "https://audio.example.com",
      robotsDirective: "index,follow",
    });
    expect(
      resolveSiteIndexingConfigFromSite(new URL("https://audio.example.com")),
    ).toEqual(config);
    expect(buildCanonicalUrl(config, "tone-generator/index.html")).toBe(
      "https://audio.example.com/tone-generator/",
    );
    expect(buildCanonicalUrl(config, "//other.example/path")).toBe(
      "https://audio.example.com//other.example/path",
    );
    expect(buildRobotsTxt(config)).toBe(
      "User-agent: *\nAllow: /\nSitemap: https://audio.example.com/sitemap-index.xml\n",
    );
  });
});
