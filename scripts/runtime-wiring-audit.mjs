import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const toolsRoot = join(process.cwd(), "src", "tools");
const auditDir = join(process.cwd(), "audit-output");
await mkdir(auditDir, { recursive: true });

const toolDirs = (await readdir(toolsRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const report = [];
const hardFailures = [];

for (const dir of toolDirs) {
  const full = join(toolsRoot, dir);
  const files = await readdir(full);
  const astroName = files.find((name) => name.endsWith(".astro"));
  const controllerName = files.find((name) => name.endsWith("Controller.ts"));
  if (!astroName || !controllerName) continue;

  const astro = await readFile(join(full, astroName), "utf8");
  const controller = await readFile(join(full, controllerName), "utf8");

  const selectorMatches = [
    ...controller.matchAll(/["'`]((?:#[-\w]+)|(?:\[data-[-\w]+(?:=[^\]]+)?\]))["'`]/g),
  ].map((match) => match[1]);
  const selectors = [...new Set(selectorMatches)].sort();
  const selectorsNotLiteralInToolTemplate = [];

  for (const selector of selectors) {
    if (selector.startsWith("#")) {
      const id = selector.slice(1);
      if (!new RegExp(`id=["']${id}["']`).test(astro)) {
        selectorsNotLiteralInToolTemplate.push(selector);
      }
      continue;
    }
    const dataName = selector.match(/^\[(data-[-\w]+)/)?.[1];
    if (dataName && !astro.includes(dataName)) {
      selectorsNotLiteralInToolTemplate.push(selector);
    }
  }

  const duplicateIds = [];
  const ids = [...astro.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]);
  for (const id of new Set(ids)) {
    if (ids.filter((candidate) => candidate === id).length > 1) duplicateIds.push(id);
  }

  const interactiveTags = [...astro.matchAll(/<(button|input|select|textarea)\b([^>]*)>/g)].map(
    (match) => ({ tag: match[1], attrs: match[2], source: match[0] }),
  );
  const buttonsMissingType = interactiveTags
    .filter(({ tag }) => tag === "button")
    .filter(({ attrs }) => !/\btype=["']button["']/.test(attrs))
    .map(({ source }) => source.slice(0, 180));

  const interactiveDataAttrs = [];
  for (const interactive of interactiveTags) {
    for (const match of interactive.attrs.matchAll(/\b(data-[-\w]+)(?:=["'][^"']*["'])?/g)) {
      interactiveDataAttrs.push(match[1]);
    }
  }
  const unreferencedInteractiveDataAttrs = [...new Set(interactiveDataAttrs)]
    .filter((name) => !controller.includes(name))
    .sort();

  const mounted = /new\s+\w+Controller\s*\(/.test(astro) && /mount\(\)/.test(astro);
  const disposeWired = /pagehide/.test(astro) && /dispose\(\)/.test(astro);

  const item = {
    tool: dir,
    astro: astroName,
    controller: controllerName,
    selectorsChecked: selectors.length,
    selectorsNotLiteralInToolTemplate,
    duplicateIds,
    buttonsMissingType,
    unreferencedInteractiveDataAttrs,
    mounted,
    disposeWired,
  };
  report.push(item);

  // Controller selectors may legitimately resolve inside composed shared Astro components
  // (ToolStatus, CapabilityNotice, FrequencyControl, etc.), so literal absence from the
  // tool template is informational. Browser runtime checks verify actual resolution.
  if (duplicateIds.length || buttonsMissingType.length || !mounted || !disposeWired) {
    hardFailures.push(item);
  }
}

await writeFile(join(auditDir, "wiring-audit.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ tools: report.length, hardFailures: hardFailures.length }, null, 2));
for (const item of hardFailures) console.error(JSON.stringify(item, null, 2));

if (hardFailures.length > 0) process.exitCode = 1;
