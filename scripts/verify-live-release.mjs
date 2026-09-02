import process from "node:process";

const BEACON_URL = "https://static.cloudflareinsights.com/beacon.min.js";
const HTML_ROUTES = [
  "/",
  "/privacy",
  "/sound-test",
  "/speaker-test",
  "/headphone-test",
  "/stereo-test",
  "/phase-test",
  "/surround-sound-test",
  "/bass-test",
  "/tone-generator",
  "/frequency-sweep",
  "/noise-generator",
  "/microphone-test",
  "/spectrum-analyzer",
  "/pitch-detector",
  "/decibel-meter",
  "/audio-latency-test",
  "/hearing-frequency-test",
];

const DEFAULT_TIMEOUT_MS = 10_000;

const options = parseArgs(process.argv.slice(2));

if (options.help) {
  printHelp();
  process.exit(0);
}

if (options.selfTest) {
  runSelfTest();
  process.stdout.write("Live release verifier self-test passed.\n");
  process.exit(0);
}

const origin = normalizeProductionOrigin(options.origin);
const indexing = parseExpectation("--indexing", options.indexing);
const analytics = parseExpectation("--analytics", options.analytics);
const timeoutMs = parseTimeout(options.timeoutMs);

await verifyLiveRelease({ origin, indexing, analytics, timeoutMs });

process.stdout.write(
  `Live release verified at ${origin}: indexing=${indexing}, analytics=${analytics}, routes=${HTML_ROUTES.length}.\n`,
);

async function verifyLiveRelease({ origin, indexing, analytics, timeoutMs }) {
  const htmlByRoute = new Map();

  for (const route of HTML_ROUTES) {
    const response = await fetchText(new URL(route, `${origin}/`), {
      origin,
      timeoutMs,
      expectedStatuses: [200],
    });

    verifyHtml({
      html: response.text,
      route,
      origin,
      indexing,
      analytics,
    });
    htmlByRoute.set(route, response.text);
  }

  const robots = await fetchText(new URL("/robots.txt", `${origin}/`), {
    origin,
    timeoutMs,
    expectedStatuses: [200],
  });
  verifyRobots({ text: robots.text, origin, indexing });

  if (indexing === "enabled") {
    const sitemapIndex = await fetchText(
      new URL("/sitemap-index.xml", `${origin}/`),
      {
        origin,
        timeoutMs,
        expectedStatuses: [200],
      },
    );
    const sitemap = await fetchText(new URL("/sitemap-0.xml", `${origin}/`), {
      origin,
      timeoutMs,
      expectedStatuses: [200],
    });

    verifyEnabledSitemaps({
      sitemapIndex: sitemapIndex.text,
      sitemap: sitemap.text,
      origin,
    });
  } else {
    const sitemapIndex = await fetchText(
      new URL("/sitemap-index.xml", `${origin}/`),
      {
        origin,
        timeoutMs,
        expectedStatuses: [404, 410],
      },
    );

    if (sitemapIndex.status === 200) {
      throw new Error(
        "Indexing is expected disabled, but /sitemap-index.xml is still publicly available.",
      );
    }
  }

  const privacyHtml = htmlByRoute.get("/privacy");
  if (!privacyHtml) {
    throw new Error("Live release verifier did not capture /privacy.");
  }

  if (analytics === "enabled") {
    assertIncludes(
      privacyHtml,
      "Cloudflare Web Analytics is enabled for this build",
      "/privacy enabled analytics disclosure",
    );
  } else {
    assertIncludes(
      privacyHtml,
      "This build does not enable an analytics provider.",
      "/privacy disabled analytics disclosure",
    );
  }
}

function verifyHtml({ html, route, origin, indexing, analytics }) {
  const robotsDirective = extractMetaContent(html, "robots");
  const canonical = extractCanonical(html);

  if (indexing === "enabled") {
    assertEqual(robotsDirective, "index,follow", `${route} robots metadata`);
    assertEqual(
      canonical,
      expectedCanonical(origin, route),
      `${route} canonical`,
    );
  } else {
    assertEqual(
      robotsDirective,
      "noindex,nofollow",
      `${route} robots metadata`,
    );
    if (canonical !== null) {
      throw new Error(
        `${route} unexpectedly exposes canonical ${canonical} while indexing is expected disabled.`,
      );
    }
  }

  const beaconCount = countOccurrences(html, BEACON_URL);
  const configCount = countOccurrences(html, "data-cf-beacon");

  if (analytics === "enabled") {
    assertEqual(beaconCount, 1, `${route} Cloudflare beacon count`);
    assertEqual(configCount, 1, `${route} data-cf-beacon count`);
    assertIncludes(html, 'type="module"', `${route} Cloudflare module script`);
  } else {
    assertEqual(beaconCount, 0, `${route} Cloudflare beacon count`);
    assertEqual(configCount, 0, `${route} data-cf-beacon count`);
  }
}

function verifyRobots({ text, origin, indexing }) {
  const normalized = normalizeText(text);
  const expected =
    indexing === "enabled"
      ? `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap-index.xml`
      : "User-agent: *\nAllow: /";

  assertEqual(normalized, expected, "robots.txt");
}

function verifyEnabledSitemaps({ sitemapIndex, sitemap, origin }) {
  assertIncludes(
    sitemapIndex,
    `<loc>${origin}/sitemap-0.xml</loc>`,
    "sitemap index",
  );

  assertAllSitemapLocationsStayOnOrigin(sitemapIndex, origin, "sitemap index");
  assertAllSitemapLocationsStayOnOrigin(sitemap, origin, "sitemap");

  for (const route of HTML_ROUTES) {
    const canonical = expectedCanonical(origin, route);
    assertIncludes(
      sitemap,
      `<loc>${escapeXml(canonical)}</loc>`,
      `${route} sitemap entry`,
    );
  }
}

async function fetchText(url, { origin, timeoutMs, expectedStatuses }) {
  let response;
  try {
    response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "user-agent": "BrowserAudioLabReleaseVerifier/1.0",
      },
    });
  } catch (error) {
    throw new Error(`Request failed for ${url.href}: ${formatError(error)}`);
  }

  const finalUrl = new URL(response.url);
  if (finalUrl.protocol !== "https:" || finalUrl.origin !== origin) {
    throw new Error(
      `${url.href} redirected outside the expected HTTPS origin: ${response.url}`,
    );
  }

  if (!expectedStatuses.includes(response.status)) {
    throw new Error(
      `${url.href} returned HTTP ${response.status}; expected ${expectedStatuses.join(" or ")}.`,
    );
  }

  return {
    status: response.status,
    text: await response.text(),
  };
}

function parseArgs(args) {
  const parsed = {
    origin: null,
    indexing: null,
    analytics: null,
    timeoutMs: null,
    selfTest: false,
    help: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--self-test") {
      parsed.selfTest = true;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }

    if (
      arg === "--origin" ||
      arg === "--indexing" ||
      arg === "--analytics" ||
      arg === "--timeout-ms"
    ) {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${arg} requires a value.`);
      }
      index += 1;

      if (arg === "--origin") parsed.origin = value;
      if (arg === "--indexing") parsed.indexing = value;
      if (arg === "--analytics") parsed.analytics = value;
      if (arg === "--timeout-ms") parsed.timeoutMs = value;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function normalizeProductionOrigin(rawOrigin) {
  if (!rawOrigin) {
    throw new Error("--origin is required for live release verification.");
  }

  let origin;
  try {
    origin = new URL(rawOrigin.trim());
  } catch {
    throw new Error("--origin must be a valid absolute HTTPS origin.");
  }

  if (origin.protocol !== "https:") {
    throw new Error("--origin must use https://.");
  }

  if (!origin.hostname) {
    throw new Error("--origin must include a hostname.");
  }

  if (
    origin.pathname !== "/" ||
    origin.search !== "" ||
    origin.hash !== "" ||
    origin.username !== "" ||
    origin.password !== ""
  ) {
    throw new Error(
      "--origin must be an origin only, without credentials, path, query, or hash.",
    );
  }

  return origin.origin;
}

function parseExpectation(flag, value) {
  if (value !== "enabled" && value !== "disabled") {
    throw new Error(`${flag} must be exactly "enabled" or "disabled".`);
  }
  return value;
}

function parseTimeout(rawValue) {
  if (rawValue === null) return DEFAULT_TIMEOUT_MS;

  const value = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(value) || value < 1_000 || value > 60_000) {
    throw new Error("--timeout-ms must be an integer between 1000 and 60000.");
  }

  return value;
}

function extractMetaContent(html, name) {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const nameMatch = tag.match(/\bname=["']([^"']+)["']/i);
    if (nameMatch?.[1]?.toLowerCase() !== name.toLowerCase()) continue;

    const contentMatch = tag.match(/\bcontent=["']([^"']*)["']/i);
    if (!contentMatch) {
      throw new Error(`Meta ${name} is missing a content attribute.`);
    }
    return contentMatch[1] ?? "";
  }

  throw new Error(`Missing meta tag: ${name}`);
}

function extractCanonical(html) {
  const links = html.match(/<link\b[^>]*>/gi) ?? [];
  for (const tag of links) {
    const relMatch = tag.match(/\brel=["']([^"']+)["']/i);
    if (!relMatch?.[1]?.split(/\s+/).includes("canonical")) continue;

    const hrefMatch = tag.match(/\bhref=["']([^"']+)["']/i);
    if (!hrefMatch) {
      throw new Error("Canonical link is missing href.");
    }
    return hrefMatch[1] ?? "";
  }

  return null;
}

function expectedCanonical(origin, route) {
  return new URL(route, `${origin}/`).href;
}

function assertAllSitemapLocationsStayOnOrigin(xml, origin, label) {
  const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    (match) => match[1],
  );

  if (locations.length === 0) {
    throw new Error(`${label} contains no <loc> entries.`);
  }

  for (const location of locations) {
    const decoded = decodeXml(location ?? "");
    let parsed;
    try {
      parsed = new URL(decoded);
    } catch {
      throw new Error(`${label} contains an invalid URL: ${decoded}`);
    }

    if (parsed.origin !== origin || parsed.protocol !== "https:") {
      throw new Error(`${label} escaped the expected origin: ${decoded}`);
    }
  }
}

function normalizeText(value) {
  return value.replaceAll("\r\n", "\n").trimEnd();
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function decodeXml(value) {
  return value
    .replaceAll("&apos;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&gt;", ">")
    .replaceAll("&lt;", "<")
    .replaceAll("&amp;", "&");
}

function countOccurrences(actual, needle) {
  return actual.split(needle).length - 1;
}

function assertIncludes(actual, expected, label) {
  if (!actual.includes(expected)) {
    throw new Error(`${label} is missing expected content: ${expected}`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(
      `${label} mismatch. Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}.`,
    );
  }
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

function expectThrows(callback, expectedPattern) {
  try {
    callback();
  } catch (error) {
    const message = formatError(error);
    if (!expectedPattern.test(message)) {
      throw new Error(
        `Self-test expected ${expectedPattern}, got error: ${message}`,
      );
    }
    return;
  }

  throw new Error(`Self-test expected an error matching ${expectedPattern}.`);
}

function runSelfTest() {
  const origin = "https://audio.example";
  const disabledHtml =
    '<!doctype html><meta name="robots" content="noindex,nofollow"><p>This build does not enable an analytics provider.</p>';
  const enabledHtml = `<!doctype html><meta content="index,follow" name="robots"><link href="${origin}/privacy" rel="canonical"><script type="module" src="${BEACON_URL}" data-cf-beacon="{&quot;token&quot;:&quot;x&quot;,&quot;spa&quot;:false}"></script><p>Cloudflare Web Analytics is enabled for this build</p>`;

  assertEqual(
    normalizeProductionOrigin(`${origin}/`),
    origin,
    "origin normalization",
  );
  expectThrows(
    () => normalizeProductionOrigin("http://audio.example"),
    /must use https/,
  );
  expectThrows(
    () => normalizeProductionOrigin("https://audio.example/path"),
    /origin only/,
  );

  verifyHtml({
    html: disabledHtml,
    route: "/privacy",
    origin,
    indexing: "disabled",
    analytics: "disabled",
  });
  verifyHtml({
    html: enabledHtml,
    route: "/privacy",
    origin,
    indexing: "enabled",
    analytics: "enabled",
  });

  expectThrows(
    () =>
      verifyHtml({
        html: `${disabledHtml}<script src="${BEACON_URL}" data-cf-beacon="x"></script>`,
        route: "/privacy",
        origin,
        indexing: "disabled",
        analytics: "disabled",
      }),
    /beacon count mismatch/,
  );
  expectThrows(
    () =>
      verifyHtml({
        html: enabledHtml.replace(
          `${origin}/privacy`,
          "https://other.example/privacy",
        ),
        route: "/privacy",
        origin,
        indexing: "enabled",
        analytics: "enabled",
      }),
    /canonical mismatch/,
  );

  verifyRobots({
    text: "User-agent: *\nAllow: /\n",
    origin,
    indexing: "disabled",
  });
  verifyRobots({
    text: `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap-index.xml\n`,
    origin,
    indexing: "enabled",
  });

  const sitemapIndex = `<sitemapindex><sitemap><loc>${origin}/sitemap-0.xml</loc></sitemap></sitemapindex>`;
  const sitemap = `<urlset>${HTML_ROUTES.map(
    (route) =>
      `<url><loc>${escapeXml(expectedCanonical(origin, route))}</loc></url>`,
  ).join("")}</urlset>`;
  verifyEnabledSitemaps({ sitemapIndex, sitemap, origin });

  expectThrows(
    () =>
      assertAllSitemapLocationsStayOnOrigin(
        "<urlset><url><loc>https://other.example/</loc></url></urlset>",
        origin,
        "sitemap",
      ),
    /escaped the expected origin/,
  );

  assertEqual(
    parseExpectation("--indexing", "enabled"),
    "enabled",
    "expectation",
  );
  expectThrows(
    () => parseExpectation("--analytics", "maybe"),
    /must be exactly/,
  );
  assertEqual(parseTimeout(null), DEFAULT_TIMEOUT_MS, "default timeout");
  expectThrows(() => parseTimeout("999"), /between 1000 and 60000/);
}

function printHelp() {
  process.stdout.write(
    `Browser Audio Lab live release verifier\n\nUsage:\n  pnpm verify:live-release -- --origin https://example.com --indexing disabled --analytics disabled\n  pnpm verify:live-release -- --origin https://example.com --indexing enabled --analytics enabled\n\nOptions:\n  --origin <https-origin>        Real deployed origin. Origin only; no path/query/hash.\n  --indexing enabled|disabled   Expected live indexing state. Required.\n  --analytics enabled|disabled  Expected live analytics state. Required.\n  --timeout-ms <1000-60000>     Per-request timeout. Default: ${DEFAULT_TIMEOUT_MS}.\n  --self-test                   Run deterministic local contract tests; no network.\n  --help                        Show this help.\n\nThe verifier checks all 18 HTML routes, robots metadata, canonical behavior, robots.txt, sitemap state, Cloudflare beacon count, same-origin redirects, and /privacy build-state disclosure. It does not prove that Cloudflare received an analytics event or that Search Console indexed the site.\n`,
  );
}
