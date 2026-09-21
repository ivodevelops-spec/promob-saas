// netlify/functions/health.ts — Health check real (200 ok).
import type { NetlifyHandler } from "../../src/netlify";

const handler: NetlifyHandler = () =>
  new Response(
    JSON.stringify({ ok: true, service: "promob-saas", ts: new Date().toISOString() }),
    { status: 200, headers: { "content-type": "application/json" } },
  );

export default handler;
