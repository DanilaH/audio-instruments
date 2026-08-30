import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const TEST_ORIGIN = "https://indexing-test.example";
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

const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const build = spawnSync(pnpmCommand, ["exec", "astro", "build"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    SITE_INDEXING: "enabled",
    SITE_ORIGIN: TEST_ORIGIN,
  },
  stdio: "inherit",
});

if (build.error) {
  throw build.error;
}

if (build.status !== 0) {
  throw new Error(`Indexed Astro build failed with exit code ${build.status}.`);
}

const dist = path.join(process.cwd(), "dist");
const sitemapIndex = await readFile(
  path.join(dist, "sitemap-index.xml"),
  "utf8",
);
const sitemap = await readFile(path.join(dist, "sitemap-0.xml"), "utf8");
const robots = await readFile(path.join(dist, "robots.txt"), "utf8");

assertIncludes(
  sitemapIndex,
  `<loc>${TEST_ORIGIN}/sitemap-0.xml</loc>`,
  "sitemap index",
);
assertEqual(
  robots,
  `User-agent: *\nAllow: /\nSitemap: ${TEST_ORIGIN}/sitemap-index.xml\n`,
  "robots.txt",
);

for (const route of HTML_ROUTES) {
  const html = await readFile(routeOutputPath(dist, route), "utf8");
  assertIncludes(
    html,
    '<meta name="robots" content="index,follow">',
    `${route} robots metadata`,
  );

  const canonical = extractCanonical(html, route);
  if (!canonical.startsWith(`${TEST_ORIGIN}/`)) {
    throw new Error(
      `${route} canonical escaped the configured origin: ${canonical}`,
    );
  }

  assertIncludes(
    sitemap,
    `<loc>${escapeXml(canonical)}</loc>`,
    `${route} sitemap entry`,
  );
}

console.log(
  `Indexed build verified for ${HTML_ROUTES.length} HTML routes at ${TEST_ORIGIN}.`,
);

function routeOutputPath(distDir, route) {
  if (route === "/") {
    return path.join(distDir, "index.html");
  }

  return path.join(distDir, route.slice(1), "index.html");
}

function extractCanonical(html, route) {
  const match = html.match(/<link rel="canonical" href="([^"]+)">/);
  if (!match) {
    throw new Error(`${route} is missing a canonical link in the indexed build.`);
  }

  return match[1];
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function assertIncludes(actual, expected, label) {
  if (!actual.includes(expected)) {
    throw new Error(`${label} is missing expected content: ${expected}`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(
      `${label} did not match the indexed-build contract.\nExpected:\n${expected}\nActual:\n${actual}`,
    );
  }
}
