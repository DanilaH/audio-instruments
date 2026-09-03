import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const caddyfilePath = path.join(process.cwd(), "deploy", "Caddyfile");
const caddyfile = await readFile(caddyfilePath, "utf8");

assertIncludes(
  caddyfile,
  "{$SITE_DOMAIN}",
  "site-domain environment placeholder",
);
assertIncludes(
  caddyfile,
  "{$SITE_ROOT:/srv/browser-audio-lab/current}",
  "site-root environment placeholder",
);
assertIncludes(caddyfile, "encode zstd gzip", "compression");
assertIncludes(
  caddyfile,
  "try_files {path}.html {path}/index.html {path}",
  "extensionless Astro route rewrite",
);
assertIncludes(
  caddyfile,
  "@immutableAssets path /_astro/*",
  "Astro asset matcher",
);
assertIncludes(
  caddyfile,
  'Cache-Control "public, max-age=31536000, immutable"',
  "immutable Astro asset caching",
);
assertIncludes(caddyfile, "file_server", "static file server");

assertNotMatches(
  caddyfile,
  /(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+\.(?:com|net|org|io|dev|app|ru)\b/i,
  "hard-coded production hostname",
);
assertNotMatches(
  caddyfile,
  /^\s*reverse_proxy(?:\s|$)/m,
  "unexpected application server proxy directive",
);
assertNotMatches(
  caddyfile,
  /^\s*redir(?:\s|$)/m,
  "route redirect directive that could rewrite canonical paths",
);

process.stdout.write("VPS/Caddy deployment contract verified.\n");

function assertIncludes(actual, expected, label) {
  if (!actual.includes(expected)) {
    throw new Error(`${label} is missing expected content: ${expected}`);
  }
}

function assertNotMatches(actual, pattern, label) {
  const match = actual.match(pattern);
  if (match) {
    throw new Error(`${label} unexpectedly contains: ${match[0]}`);
  }
}
