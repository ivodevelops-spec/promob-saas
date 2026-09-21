// netlify/functions/cron-dunning.ts — Recordatorios + dunning (scheduled, diario). W2.
import { notImplemented, type NetlifyFunctionConfig, type NetlifyHandler } from "../../src/netlify";

export const config: NetlifyFunctionConfig = {
  schedule: "@daily",
};

const handler: NetlifyHandler = () => notImplemented("W2");

export default handler;
