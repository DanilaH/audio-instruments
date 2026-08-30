import type { APIRoute } from "astro";

import {
  buildRobotsTxt,
  resolveSiteIndexingConfigFromSite,
} from "../config/site-indexing";

export const prerender = true;

export const GET: APIRoute = ({ site }) => {
  const indexing = resolveSiteIndexingConfigFromSite(site);

  return new Response(buildRobotsTxt(indexing), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
};
