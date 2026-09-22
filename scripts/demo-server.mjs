// scripts/demo-server.mjs — Servidor local del modo demo.
//
// Sirve el sitio (`web/dist`), el panel (`/admin`) y monta las funciones Netlify
// (estilo v2: Request → Response) sobre el http de Node, con el simulador en
// `/api/demo/simulate`. Todo comparte UNA runtime (memoria + mock + outbox).
//
// Uso:  npm run build && npm run demo   →  http://localhost:8787
import { createServer } from "node:http";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build as esbuild } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(root, "web", "dist");
const bundleDir = path.join(root, "out", "server-functions");
const bundleEntry = path.join(bundleDir, "demo-entry.mjs");
const port = Number.parseInt(process.env.PORT ?? "8787", 10);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

// --- Compilación (esbuild) del bundle compartido --------------------------------

async function buildDemoBundle() {
  await esbuild({
    entryPoints: [path.join(root, "src", "demo-entry.ts")],
    outfile: bundleEntry,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    logLevel: "warning",
  });
}

async function checkDist() {
  try {
    const info = await stat(path.join(distDir, "index.html"));
    return info.isFile();
  } catch {
    return false;
  }
}

// --- Helpers HTTP ---------------------------------------------------------------

function sendJson(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function readJsonBody(req) {
  try {
    const raw = await readRawBody(req);
    if (raw.length === 0) return null;
    return JSON.parse(raw.toString("utf8"));
  } catch {
    return null;
  }
}

/** Convierte el request de Node en un `Request` web (lo que esperan las funciones). */
async function toWebRequest(req, rawBody) {
  const url = `http://${req.headers.host ?? `localhost:${port}`}${req.url ?? "/"}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (key === "host" || key === "connection" || key === "content-length") continue;
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else {
      headers.append(key, value);
    }
  }
  const method = req.method ?? "GET";
  const hasBody = method !== "GET" && method !== "HEAD" && rawBody.length > 0;
  return new Request(url, {
    method,
    headers,
    ...(hasBody ? { body: rawBody } : {}),
  });
}

/** Escribe un `Response` web en el response de Node. */
async function sendWebResponse(res, webResponse) {
  const pairs = [];
  for (const [key, value] of webResponse.headers.entries()) {
    if (key === "set-cookie") continue;
    pairs.push([key, value]);
  }
  if (typeof webResponse.headers.getSetCookie === "function") {
    for (const cookie of webResponse.headers.getSetCookie()) {
      pairs.push(["set-cookie", cookie]);
    }
  }
  res.writeHead(webResponse.status, pairs);
  const buffer = Buffer.from(await webResponse.arrayBuffer());
  res.end(buffer);
}

// --- Estáticos ----------------------------------------------------------------------

function resolveInsideDist(relativePath) {
  const base = path.normalize(path.join(distDir, relativePath));
  return base.startsWith(distDir) ? base : null;
}

async function findStaticFile(pathname) {
  const candidates = [];
  if (pathname.endsWith("/")) {
    const dir = resolveInsideDist(pathname);
    if (dir !== null) candidates.push(path.join(dir, "index.html"));
  } else {
    const direct = resolveInsideDist(pathname);
    if (direct !== null) candidates.push(direct);
    const withIndex = resolveInsideDist(path.join(pathname, "index.html"));
    if (withIndex !== null) candidates.push(withIndex);
  }
  for (const candidate of candidates) {
    try {
      const info = await stat(candidate);
      if (info.isFile()) return candidate;
    } catch {
      // sigue con el próximo candidato
    }
  }
  return null;
}

async function sendFile(res, filePath, status) {
  const content = await readFile(filePath);
  res.writeHead(status, {
    "content-type": MIME[path.extname(filePath).toLowerCase()] ?? "application/octet-stream",
    "cache-control": "no-store",
  });
  res.end(content);
}

async function serveStatic(res, pathname) {
  const file = await findStaticFile(pathname);
  if (file !== null) return await sendFile(res, file, 200);

  // Fallback del SPA del panel (/admin/* → /admin/index.html).
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const index = path.join(distDir, "admin", "index.html");
    try {
      const info = await stat(index);
      if (info.isFile()) return await sendFile(res, index, 200);
    } catch {
      // sin panel compilado
    }
  }

  // 404 del sitio (Astro genera 404.html).
  const notFound = path.join(distDir, "404.html");
  try {
    const info = await stat(notFound);
    if (info.isFile()) return await sendFile(res, notFound, 404);
  } catch {
    // sin 404 compilado
  }
  return sendJson(res, 404, { error: { code: "not_found", message: "Recurso no encontrado." } });
}

// --- Simulador (/api/demo/*) ----------------------------------------------------------

async function handleSimulate(req, res, demo) {
  const body = await readJsonBody(req);
  const scenario = typeof body?.scenario === "string" ? body.scenario : null;
  const runtime = await demo.getRuntime();

  switch (scenario) {
    case "advance-days": {
      const days = typeof body?.days === "number" ? body.days : 1;
      await runtime.repo.advanceDays(days);
      const dunning = await demo.runDunning(runtime);
      return sendJson(res, 200, { ok: true, days, now: runtime.repo.getNow(), dunning });
    }
    case "run-cron": {
      const dunning = await demo.runDunning(runtime);
      return sendJson(res, 200, { ok: true, now: runtime.repo.getNow(), dunning });
    }
    case "charge-failed": {
      const targetId = typeof body?.targetId === "string" ? body.targetId : null;
      if (targetId === null) {
        return sendJson(res, 400, {
          error: { code: "bad_request", message: "Falta `targetId` (suscripción)." },
        });
      }
      const ok = await demo.failSubscriptionCharge(runtime, targetId);
      return sendJson(res, 200, { ok, now: runtime.repo.getNow() });
    }
    case "reset": {
      const { rm } = await import("node:fs/promises");
      await rm(path.join(runtime.config.outDir, "demo-db.json"), { force: true });
      demo.resetRuntime();
      const fresh = await demo.getRuntime();
      return sendJson(res, 200, { ok: true, now: fresh.repo.getNow() });
    }
    default:
      return sendJson(res, 400, {
        error: {
          code: "unknown_scenario",
          message: `Escenario desconocido: ${String(scenario)}. Use: advance-days | run-cron | charge-failed | reset.`,
        },
      });
  }
}

/** Lista los emails generados (bandeja de salida del demo). */
async function handleOutboxList(res) {
  const outboxDir = path.join(root, "out", "outbox");
  let files = [];
  try {
    const entries = await readdir(outboxDir);
    files = entries
      .filter((name) => name.endsWith(".html"))
      .sort()
      .reverse()
      .slice(0, 100)
      .map((name) => ({ file: name, url: `/api/demo/outbox/${encodeURIComponent(name)}` }));
  } catch {
    files = [];
  }
  return sendJson(res, 200, { ok: true, count: files.length, files });
}

/** Sirve un email HTML de la bandeja de salida (nombre validado, sin traversal). */
async function handleOutboxFile(res, pathname) {
  const name = decodeURIComponent(pathname.slice("/api/demo/outbox/".length));
  if (!/^[A-Za-z0-9._-]+\.html$/.test(name)) {
    return sendJson(res, 400, { error: { code: "bad_name", message: "Nombre inválido." } });
  }
  try {
    const content = await readFile(path.join(root, "out", "outbox", name));
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    });
    res.end(content);
  } catch {
    return sendJson(res, 404, { error: { code: "not_found", message: "Email no encontrado." } });
  }
}

// --- Arranque -----------------------------------------------------------------------------

async function main() {
  if (!(await checkDist())) {
    console.error(
      "[demo] No se encontró web/dist. Ejecutá primero:  npm run build   y volvé a intentar.",
    );
    process.exit(1);
  }
  await buildDemoBundle();
  const demo = await import(pathToFileURL(bundleEntry).href);

  const server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);

      if (pathname === "/api/demo/simulate" && req.method === "POST") {
        return await handleSimulate(req, res, demo);
      }
      if (pathname === "/api/demo/outbox" && req.method === "GET") {
        return await handleOutboxList(res);
      }
      if (pathname.startsWith("/api/demo/outbox/") && req.method === "GET") {
        return await handleOutboxFile(res, pathname);
      }
      if (pathname.startsWith("/api/")) {
        const name = pathname.slice("/api/".length).replace(/\/+$/, "");
        const handler = demo.functions[name];
        if (typeof handler !== "function") {
          return sendJson(res, 404, {
            error: { code: "unknown_function", message: `Función desconocida: ${name}.` },
          });
        }
        const rawBody = await readRawBody(req);
        const webRequest = await toWebRequest(req, rawBody);
        const context = { requestId: randomUUID(), ip: req.socket.remoteAddress ?? "", log: console.log };
        const webResponse = await handler(webRequest, context);
        return await sendWebResponse(res, webResponse);
      }
      return await serveStatic(res, pathname);
    } catch (error) {
      console.error("[demo] Error inesperado:", error);
      sendJson(res, 500, {
        error: {
          code: "demo_error",
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
  });

  server.listen(port, () => {
    console.log("");
    console.log("  PROMOB — modo demo (local)");
    console.log(`  Sitio:      http://localhost:${port}/`);
    console.log(`  Panel:      http://localhost:${port}/admin`);
    console.log(`  Health:     http://localhost:${port}/api/health`);
    console.log(`  Simulador:  POST http://localhost:${port}/api/demo/simulate`);
    console.log("");
    console.log("  MODO DEMO — montos de ejemplo — no se realizan cobros reales.");
    console.log("");
  });
}

await main();
