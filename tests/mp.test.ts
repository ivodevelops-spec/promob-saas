// Pruebas de src/mp.ts: verificación de firma de webhooks y simulador de pagos.

import { describe, expect, it } from "vitest";
import { createMockPay, verifyWebhookSignature } from "../src/mp";

// Vectores fijos generados UNA SOLA VEZ con node -e (independientes de la
// implementación):
//   node -e "const c=require('crypto');
//     ['id:12345;request-id:req-1;ts:1700000000;','id:12345;ts:1700000000;',
//      'id:abcde123;ts:1700000000;'].forEach(m=>console.log(c.createHmac('sha256','test-secret').update(m).digest('hex')))"
const SECRET = "test-secret";
const TS = "1700000000";
// HMAC de "id:12345;request-id:req-1;ts:1700000000;"
const V1_COMPLETO = "767ca542b07f83fbe1713c55f4db7ab3a9860271816a15ac34dba8404b818588";
// HMAC de "id:12345;ts:1700000000;" (sin request-id)
const V1_SIN_REQUEST_ID = "bbba329cfbcafd5a0b3cfdd52fa301483929183bc236f21d683fce12c8ed1f1c";
// HMAC de "id:abcde123;ts:1700000000;" (dataId ya minúsculas)
const V1_MINUSCULAS = "93410ab5355599fe44f54de05f9bc8ffa8dc25cad5a6d5c5e149819cb7a839eb";

function buildXSignature(v1: string, ts: string = TS): string {
  return `ts=${ts},v1=${v1}`;
}

describe("verifyWebhookSignature", () => {
  it("verifica un vector fijo conocido (manifiesto completo)", () => {
    const ok = verifyWebhookSignature({
      xSignature: buildXSignature(V1_COMPLETO),
      secret: SECRET,
      dataId: "12345",
      requestId: "req-1",
    });
    expect(ok).toBe(true);
  });

  it("rechaza un v1 manipulado", () => {
    // Cambiamos el primer carácter hex por otro distinto, misma longitud.
    const tampered = V1_COMPLETO.startsWith("a") ? `b${V1_COMPLETO.slice(1)}` : `a${V1_COMPLETO.slice(1)}`;
    const ok = verifyWebhookSignature({
      xSignature: buildXSignature(tampered),
      secret: SECRET,
      dataId: "12345",
      requestId: "req-1",
    });
    expect(ok).toBe(false);
  });

  it("rechaza un header malformado (sin v1)", () => {
    const ok = verifyWebhookSignature({
      xSignature: `ts=${TS},otra-clave=otro-valor`,
      secret: SECRET,
      dataId: "12345",
      requestId: "req-1",
    });
    expect(ok).toBe(false);
  });

  it("rechaza un xSignature nulo o vacío", () => {
    expect(
      verifyWebhookSignature({ xSignature: null, secret: SECRET, dataId: "12345", requestId: "req-1" }),
    ).toBe(false);
    expect(
      verifyWebhookSignature({ xSignature: "", secret: SECRET, dataId: "12345", requestId: "req-1" }),
    ).toBe(false);
  });

  it("verifica sin requestId (manifiesto sin ese segmento)", () => {
    const ok = verifyWebhookSignature({
      xSignature: buildXSignature(V1_SIN_REQUEST_ID),
      secret: SECRET,
      dataId: "12345",
      requestId: null,
    });
    expect(ok).toBe(true);
  });

  it("minúsculiza el dataId alfanumérico antes de firmar", () => {
    // El vector está firmado con "abcde123"; pasamos "ABCDE123" en mayúsculas.
    const ok = verifyWebhookSignature({
      xSignature: buildXSignature(V1_MINUSCULAS),
      secret: SECRET,
      dataId: "ABCDE123",
      requestId: null,
    });
    expect(ok).toBe(true);
  });
});

describe("createMockPay", () => {
  it("rechaza tarjetas terminadas en 0002", () => {
    const pay = createMockPay();
    const result = pay({ last4: "0002", amountArs: 1000 });
    expect(result.status).toBe("rejected");
    expect(result.mpPaymentId).toMatch(/^mock_0002_[a-z0-9]+$/);
  });

  it("deja pendientes tarjetas terminadas en 0009", () => {
    const pay = createMockPay();
    const result = pay({ last4: "0009", amountArs: 1000 });
    expect(result.status).toBe("pending");
  });

  it("aprueba cualquier otra tarjeta", () => {
    const pay = createMockPay();
    const result = pay({ last4: "1234", amountArs: 1000 });
    expect(result.status).toBe("approved");
  });

  it("scenarioOverride gana sobre las reglas por defecto", () => {
    const pay = createMockPay({ scenarioOverride: () => "approved" });
    const result = pay({ last4: "0002", amountArs: 1000 });
    expect(result.status).toBe("approved");
  });

  it("scenarioOverride que devuelve null cae a las reglas por defecto", () => {
    const pay = createMockPay({ scenarioOverride: () => null });
    const result = pay({ last4: "0002", amountArs: 1000 });
    expect(result.status).toBe("rejected");
  });
});
