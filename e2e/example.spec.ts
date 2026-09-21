import { test, expect } from "@playwright/test";

// Esqueleto E2E. Se ejecuta solo si E2E=1 (los navegadores no se descargan en W0).
const runE2E = process.env.E2E === "1";

test("home carga el título", async ({ page }) => {
  test.skip(!runE2E, "E2E deshabilitado (E2E != 1)");
  await page.goto("/");
  await expect(page).toHaveTitle(/Promob/);
});
