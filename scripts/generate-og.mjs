// scripts/generate-og.mjs — Genera la imagen OpenGraph del sitio (1200×630).
//
// Uso:  node scripts/generate-og.mjs   →  web/public/og.png
// Se re-ejecuta cuando cambie el claim de la home o la marca.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outFile = path.join(root, "web", "public", "og.png");

const MARK = `<svg width="34" height="34" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" rx="7" fill="#123b25"/><rect x="8" y="8" width="16" height="6.5" rx="1.5" fill="#e8c393"/><rect x="8" y="17.5" width="16" height="6.5" rx="1.5" fill="#e8c393"/><rect x="12" y="10.5" width="8" height="1.5" rx="0.75" fill="#123b25"/><rect x="12" y="20" width="8" height="1.5" rx="0.75" fill="#123b25"/></svg>`;

const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; font-family: "Segoe UI", Arial, sans-serif;
         background: linear-gradient(135deg, #123b25 0%, #1b5e3b 55%, #2a7a4c 100%);
         color: #ffffff; display: flex; flex-direction: column; justify-content: space-between;
         padding: 54px 64px; }
  .top { display: flex; align-items: center; gap: 16px; }
  .mark { width: 56px; height: 56px; background: #e8c393; border-radius: 14px; display: flex; align-items: center; justify-content: center; }
  .brand { font-size: 26px; font-weight: 800; letter-spacing: 3px; }
  h1 { font-size: 52px; line-height: 1.14; font-weight: 800; max-width: 920px; }
  h1 em { font-style: normal; color: #e8c393; }
  .sub { font-size: 21px; color: #d9e8de; margin-top: 20px; }
  .foot { display: flex; justify-content: space-between; align-items: center; font-size: 18px; color: #cfe3d6; border-top: 1px solid rgba(255,255,255,.25); padding-top: 22px; }
</style></head>
<body>
  <div class="top"><div class="mark">${MARK}</div><div class="brand">PROMOB&reg;</div></div>
  <div>
    <h1>Software para dise&ntilde;ar, fabricar y <em>gestionar</em> muebles</h1>
    <p class="sub">Dise&ntilde;o 3D &middot; Corte optimizado &middot; Gesti&oacute;n del taller &middot; Argentina, Uruguay, Chile y Paraguay</p>
  </div>
  <div class="foot"><span>promob.com.ar</span><span>Venta online &middot; Acceso por email en minutos</span></div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html, { waitUntil: "load" });
await page.screenshot({ path: outFile });
await browser.close();
console.log(`og.png generado en ${outFile}`);
