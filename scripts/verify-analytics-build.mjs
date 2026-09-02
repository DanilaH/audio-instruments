import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const TEST_TOKEN = "0123456789abcdef0123456789abcdef";
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

runBuild({
  SITE_ANALYTICS: "disabled",
  ANALYTICS_PRIVACY_REVIEW: "",
  CLOUDFLARE_WEB_ANALYTICS_TOKEN: "",
});

let dist = path.join(process.cwd(), "dist");
for (const route of HTML_ROUTES) {
  const html = await readFile(routeOutputPath(dist, route), "utf8");
  assertNotIncludes(html, BEACON_URL, `${route} disabled analytics beacon`);
  assertNotIncludes(html, TEST_TOKEN, `${route} disabled analytics token`);
}

const disabledPrivacy = await readFile(
  routeOutputPath(dist, "/privacy"),
  "utf8",
);
assertIncludes(
  disabledPrivacy,
  "No analytics provider is enabled in this build.",
  "disabled privacy disclosure",
);

runBuild({
  SITE_ANALYTICS: "cloudflare-web-analytics",
  ANALYTICS_PRIVACY_REVIEW: "approved",
  CLOUDFLARE_WEB_ANALYTICS_TOKEN: TEST_TOKEN,
});

dist = path.join(process.cwd(), "dist");
for (const route of HTML_ROUTES) {
  const html = await readFile(routeOutputPath(dist, route), "utf8");
  assertCount(html, BEACON_URL, 1, `${route} Cloudflare beacon URL`);
  assertCount(html, TEST_TOKEN, 1, `${route} Cloudflare beacon token`);
  assertIncludes(html, "data-cf-beacon", `${route} Cloudflare beacon config`);
  assertIncludes(html, "spa", `${route} Cloudflare MPA config`);
}

const enabledPrivacy = await readFile(
  routeOutputPath(dist, "/privacy"),
  "utf8",
);
assertIncludes(
  enabledPrivacy,
  "Cloudflare Web Analytics is enabled for this build",
  "enabled privacy disclosure",
);
assertIncludes(
  enabledPrivacy,
  "Microphone audio, recordings, live FFT/pitch/meter values",
  "analytics audio-content boundary",
);

process.stdout.write(
  `Analytics build contract verified for ${HTML_ROUTES.length} HTML routes in disabled and enabled states.\n`,
);

function runBuild(overrides) {
  const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const build = spawnSync(pnpmCommand, ["exec", "astro", "build"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...overrides,
    },
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (build.error) {
    throw build.error;
  }

  if (build.status !== 0) {
    throw new Error(
      `Analytics Astro build failed with exit code ${build.status}.`,
    );
  }
}

function routeOutputPath(distDir, route) {
  if (route === "/") {
    return path.join(distDir, "index.html");
  }

  return path.join(distDir, route.slice(1), "index.html");
}

function assertIncludes(actual, expected, label) {
  if (!actual.includes(expected)) {
    throw new Error(`${label} is missing expected content: ${expected}`);
  }
}

function assertNotIncludes(actual, unexpected, label) {
  if (actual.includes(unexpected)) {
    throw new Error(`${label} unexpectedly contains: ${unexpected}`);
  }
}

function assertCount(actual, needle, expectedCount, label) {
  const actualCount = actual.split(needle).length - 1;
  if (actualCount !== expectedCount) {
    throw new Error(
      `${label} expected ${expectedCount} occurrence(s), got ${actualCount}.`,
    );
  }
}
