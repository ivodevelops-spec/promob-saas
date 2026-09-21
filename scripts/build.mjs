// build.mjs — construye web (Astro) y admin (Vite) y copia admin a web/dist/admin.
// Se ejecuta desde `npm run build` (el PATH incluye node_modules/.bin).
import { spawnSync } from "node:child_process";
import { cpSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(name) {
  const result = spawnSync("npm", ["run", name], {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("build:web");
run("build:admin");

const adminDist = path.join(root, "admin", "dist");
const target = path.join(root, "web", "dist", "admin");

if (!existsSync(adminDist)) {
  console.error("[build] admin/dist no existe; falló el build del admin.");
  process.exit(1);
}

cpSync(adminDist, target, { recursive: true });
console.log("[build] admin copiado a web/dist/admin");
