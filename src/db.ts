// src/db.ts — Punto de entrada del repositorio para el modo demo.
//
// IMPORTANTE: este barrel NO importa el driver de Supabase (`./db/supabase`)
// para que el camino de demo jamás cargue `@supabase/supabase-js`.
// El driver real se importa en forma explícita desde `./db/supabase`
// únicamente cuando `DATA_DRIVER=supabase` (cableado de producción).
export * from "./db/types";
export {
  createMemoryRepository,
  type MemoryRepository,
  type MemoryRepositoryExtras,
  type MemoryRepositoryOptions,
} from "./db/memory";
export { buildDemoSeed, type DemoSeed } from "./db/seed";
