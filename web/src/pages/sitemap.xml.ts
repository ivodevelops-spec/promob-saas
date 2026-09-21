import type { APIRoute } from "astro";
import { products } from "../data/products";

const SITE_URL = "https://promob.com.ar";

export const GET: APIRoute = () => {
  const paths = [
    "/",
    "/productos/",
    ...products.map((product) => `/productos/${product.slug}/`),
    "/planes/",
    "/checkout/",
    "/contacto/",
    "/soporte/",
    "/empresa/",
    "/legales/terminos/",
    "/legales/privacidad/",
    "/legales/reembolsos/",
  ];

  const urls = paths
    .map((path) => `  <url><loc>${SITE_URL}${path}</loc></url>`)
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
};
