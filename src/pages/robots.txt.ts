import {
  buildRobotsTxt,
  resolveSiteIndexingConfig,
} from "../config/site-indexing";

export const prerender = true;

export function GET(): Response {
  const indexing = resolveSiteIndexingConfig(import.meta.env);

  return new Response(buildRobotsTxt(indexing), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
