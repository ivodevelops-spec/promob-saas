// scripts/screenshots.mjs — Capturas de QA del demo (sitio + panel) con Playwright.
//
// Uso (con el servidor de demo corriendo en otra terminal):
//   npm run demo
//   node scripts/screenshots.mjs            (o con otra URL base como argumento)
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = process.argv[2] ?? "http://localhost:8787";
const outDir = path.join(root, "out", "screenshots");
await mkdir(outDir, { recursive: true });

const DESKTOP = { viewport: { width: 1280, height: 900 } };
const MOBILE = { viewport: { width: 375, height: 812 } };

const shots = [
  { name: "01-sitio-home", url: "/" },
  { name: "02-sitio-productos", url: "/productos/" },
  { name: "03-sitio-producto-detalle", url: "/productos/promob-plus/" },
  { name: "04-sitio-planes", url: "/planes/" },
  { name: "05-sitio-checkout", url: "/checkout/" },
  { name: "06-sitio-contacto", url: "/contacto/" },
  { name: "07-sitio-soporte", url: "/soporte/" },
  { name: "13-sitio-empresa", url: "/empresa/" },
  { name: "08-panel-dashboard", url: "/admin/#/dashboard" },
  { name: "09-panel-clientes", url: "/admin/#/clientes" },
  { name: "10-panel-suscripciones", url: "/admin/#/suscripciones" },
  { name: "11-panel-codigos", url: "/admin/#/codigos" },
  { name: "12-sitio-mobile-home", url: "/", mobile: true },
];

const browser = await chromium.launch();
let ok = 0;
let failed = 0;

for (const shot of shots) {
  const context = await browser.newContext(shot.mobile === true ? MOBILE : DESKTOP);
  const page = await context.newPage();
  try {
    await page.goto(`${base}${shot.url}`, { waitUntil: "networkidle", timeout: 25000 });
    await page.waitForTimeout(700);
    await page.screenshot({
      path: path.join(outDir, `${shot.name}.png`),
      fullPage: shot.mobile !== true,
    });
    ok += 1;
    console.log(`ok   ${shot.name}`);
  } catch (error) {
    failed += 1;
    console.log(`ERR  ${shot.name}: ${error instanceof Error ? error.message : String(error)}`);
  }
  await context.close();
}

await browser.close();
console.log(`\nCapturas: ${ok} ok, ${failed} con error → ${outDir}`);
