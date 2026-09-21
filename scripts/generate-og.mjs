// scripts/generate-og.mjs — Genera la imagen OpenGraph del sitio (1200×630).
//
// Uso:  node scripts/generate-og.mjs   →  web/public/og.png
// Se re-ejecuta cuando cambie el claim de la home o la marca.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outFile = path.join(root, "web", "public", "og.png");

const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; font-family: "Segoe UI", Arial, sans-serif;
         background: linear-gradient(135deg, #2e3b44 0%, #0a6f63 55%, #0b8a7a 100%);
         color: #ffffff; display: flex; flex-direction: column; justify-content: space-between;
         padding: 54px 64px; }
  .brand { font-size: 44px; font-weight: 800; font-style: italic; letter-spacing: -1.5px; line-height: 1; }
  .tag { font-size: 13px; letter-spacing: 2px; color: #c2dbd6; margin-top: 8px; }
  .tag strong { color: #ffffff; font-weight: 600; }
  h1 { font-size: 52px; line-height: 1.14; font-weight: 800; max-width: 920px; }
  h1 em { font-style: normal; color: #c9b8ff; }
  .sub { font-size: 21px; color: #d7e8e5; margin-top: 20px; }
  .foot { display: flex; justify-content: space-between; align-items: center; font-size: 18px; color: #cfe3d6; border-top: 1px solid rgba(255,255,255,.25); padding-top: 22px; }
</style></head>
<body>
  <div><div class="brand">promob</div><div class="tag">A <strong>Cyncly</strong> Company &middot; Distribuidor Oficial</div></div>
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
