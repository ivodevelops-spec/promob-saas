// tests/state-machine.test.ts — Guards, matriz completa de transiciones,
// cronograma de mora (dunning) y registro de plantillas de email.
import { describe, expect, it } from "vitest";
import {
  CODE_POOL_STATUSES,
  isCodePoolStatus,
  isOrderStatus,
  isPaymentStatus,
  isSubscriptionStatus,
  nextDunningAction,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  SUBSCRIPTION_STATUSES,
  transitionOrder,
  transitionSubscription,
} from "../src/state-machine";
import type {
  DunningPolicy,
  OrderStatus,
  SideEffect,
  SubscriptionStatus,
} from "../src/state-machine";
import { getTemplate } from "../src/emails/index";

// ---------- Guards (contrato preexistente) ----------

describe("state-machine guards", () => {
  it("reconoce estados de orders válidos e inválidos", () => {
    expect(isOrderStatus("paid")).toBe(true);
    expect(isOrderStatus("delivered")).toBe(true);
    expect(isOrderStatus("garbage")).toBe(false);
  });

  it("expone los estados de orders definidos por el dominio", () => {
    expect([...ORDER_STATUSES]).toEqual(["pending", "paid", "failed", "refunded", "delivered"]);
  });

  it("reconoce estados de subscriptions y code_pool", () => {
    expect(isSubscriptionStatus("past_due")).toBe(true);
    expect(isSubscriptionStatus("active")).toBe(true);
    expect(SUBSCRIPTION_STATUSES).toContain("canceled");

    expect(isCodePoolStatus("unissued")).toBe(true);
    expect(CODE_POOL_STATUSES).toContain("voided");
    expect(isCodePoolStatus("unknown")).toBe(false);
  });

  it("reconoce estados de pagos", () => {
    expect(isPaymentStatus("approved")).toBe(true);
    expect(isPaymentStatus("rejected")).toBe(true);
    expect(PAYMENT_STATUSES).toContain("refunded");
    expect(isPaymentStatus("nada")).toBe(false);
  });
});

// ---------- Matriz de transiciones ----------

interface ValidTransition<S extends string> {
  from: S;
  to: S;
  effects: readonly SideEffect[];
}

const SUSPENSION_EFFECTS: readonly SideEffect[] = [
  { type: "send-email", template: "suspension" },
  { type: "send-email", template: "owner-alert" },
];

const validOrderTransitions: readonly ValidTransition<OrderStatus>[] = [
  { from: "pending", to: "paid", effects: [{ type: "send-email", template: "receipt" }] },
  { from: "pending", to: "failed", effects: [] },
  { from: "paid", to: "delivered", effects: [{ type: "deliver-code" }] },
  { from: "paid", to: "refunded", effects: [{ type: "void-code" }] },
];

const validSubscriptionTransitions: readonly ValidTransition<SubscriptionStatus>[] = [
  { from: "active", to: "past_due", effects: [] },
  { from: "active", to: "suspended", effects: SUSPENSION_EFFECTS },
  { from: "active", to: "canceled", effects: [] },
  { from: "past_due", to: "active", effects: [] },
  { from: "past_due", to: "suspended", effects: SUSPENSION_EFFECTS },
  { from: "past_due", to: "canceled", effects: [] },
  { from: "suspended", to: "active", effects: [] },
  { from: "suspended", to: "lapsed", effects: [{ type: "send-email", template: "lapse" }] },
  { from: "suspended", to: "canceled", effects: [] },
  { from: "lapsed", to: "canceled", effects: [] },
];

describe("transitionOrder", () => {
  it("cubre toda la matriz: pares válidos devuelven efectos y el resto lanza", () => {
    for (const from of ORDER_STATUSES) {
      for (const to of ORDER_STATUSES) {
        const valido = validOrderTransitions.find((t) => t.from === from && t.to === to);
        if (valido !== undefined) {
          expect(transitionOrder(from, to)).toEqual({ status: to, effects: valido.effects });
        } else {
          expect(() => transitionOrder(from, to)).toThrowError();
        }
      }
    }
  });

  it("lanza un error en español para transiciones inválidas", () => {
    expect(() => transitionOrder("pending", "delivered")).toThrowError(/inválida/);
    expect(() => transitionOrder("delivered", "refunded")).toThrowError(
      /no se puede pasar de "delivered" a "refunded"/,
    );
  });
});

describe("transitionSubscription", () => {
  it("cubre toda la matriz: pares válidos devuelven efectos y el resto lanza", () => {
    for (const from of SUBSCRIPTION_STATUSES) {
      for (const to of SUBSCRIPTION_STATUSES) {
        const valido = validSubscriptionTransitions.find(
          (t) => t.from === from && t.to === to,
        );
        if (valido !== undefined) {
          expect(transitionSubscription(from, to)).toEqual({
            status: to,
            effects: valido.effects,
          });
        } else {
          expect(() => transitionSubscription(from, to)).toThrowError();
        }
      }
    }
  });

  it("lanza un error en español para transiciones inválidas", () => {
    expect(() => transitionSubscription("lapsed", "active")).toThrowError(/inválida/);
    expect(() => transitionSubscription("canceled", "active")).toThrowError(
      /no se puede pasar de "canceled" a "active"/,
    );
  });
});

// ---------- Cronograma de mora (dunning) ----------

const D = "2026-10-01T00:00:00.000Z";
const DAY_MS = 86_400_000;
const dueAt = (offsetDays: number): string =>
  new Date(Date.parse(D) + offsetDays * DAY_MS).toISOString();
const nowAt = (offsetDays: number): Date =>
  new Date(Date.parse(D) + offsetDays * DAY_MS);
const POLICY: DunningPolicy = { graceDays: 10, lapseDays: 30 };

const sub = (
  status: SubscriptionStatus,
  nextPaymentDate: string | null = D,
): { status: SubscriptionStatus; nextPaymentDate: string | null } => ({
  status,
  nextPaymentDate,
});

describe("nextDunningAction", () => {
  it("activo lejos del vencimiento → reminder-7 a D−7", () => {
    expect(nextDunningAction(POLICY, sub("active"), nowAt(-20))).toEqual({
      kind: "reminder",
      template: "reminder-7",
      dueAt: dueAt(-7),
      offsetDays: -7,
    });
  });

  it("activo a D−5 → reminder-3 a D−3 (reminder-7 ya pasó)", () => {
    expect(nextDunningAction(POLICY, sub("active"), nowAt(-5))).toEqual({
      kind: "reminder",
      template: "reminder-3",
      dueAt: dueAt(-3),
      offsetDays: -3,
    });
  });

  it("activo a D−1 → null (todos los recordatorios ya pasaron)", () => {
    expect(nextDunningAction(POLICY, sub("active"), nowAt(-1))).toBeNull();
  });

  it("activo exactamente en D−7 → reminder-3 (el límite es estricto)", () => {
    expect(nextDunningAction(POLICY, sub("active"), nowAt(-7))).toEqual({
      kind: "reminder",
      template: "reminder-3",
      dueAt: dueAt(-3),
      offsetDays: -3,
    });
  });

  it("past_due a D+0.5 → dunning-1 a D+1", () => {
    expect(nextDunningAction(POLICY, sub("past_due"), nowAt(0.5))).toEqual({
      kind: "warning",
      template: "dunning-1",
      dueAt: dueAt(1),
      offsetDays: 1,
    });
  });

  it("past_due a D+2 → dunning-4 a D+4 (dunning-1 ya pasó)", () => {
    expect(nextDunningAction(POLICY, sub("past_due"), nowAt(2))).toEqual({
      kind: "warning",
      template: "dunning-4",
      dueAt: dueAt(4),
      offsetDays: 4,
    });
  });

  it("past_due a D+9 → suspensión en D+graceDays con alerta al owner", () => {
    expect(nextDunningAction(POLICY, sub("past_due"), nowAt(9))).toEqual({
      kind: "suspend",
      template: "suspension",
      dueAt: dueAt(POLICY.graceDays),
      offsetDays: POLICY.graceDays,
      alertOwner: true,
    });
  });

  it("suspended a D+20 → lapse en D+lapseDays", () => {
    expect(nextDunningAction(POLICY, sub("suspended"), nowAt(20))).toEqual({
      kind: "lapse",
      template: "lapse",
      dueAt: dueAt(POLICY.lapseDays),
      offsetDays: POLICY.lapseDays,
    });
  });

  it("cambiar la política mueve suspensión y lapse", () => {
    const otra: DunningPolicy = { graceDays: 14, lapseDays: 45 };

    const suspension = nextDunningAction(otra, sub("past_due"), nowAt(9));
    expect(suspension).toEqual({
      kind: "suspend",
      template: "suspension",
      dueAt: dueAt(14),
      offsetDays: 14,
      alertOwner: true,
    });

    const lapse = nextDunningAction(otra, sub("suspended"), nowAt(20));
    expect(lapse).toEqual({ kind: "lapse", template: "lapse", dueAt: dueAt(45), offsetDays: 45 });
  });

  it("lapsed o canceled → null aunque haya fecha de vencimiento", () => {
    expect(nextDunningAction(POLICY, sub("lapsed"), nowAt(0))).toBeNull();
    expect(nextDunningAction(POLICY, sub("canceled"), nowAt(0))).toBeNull();
  });

  it("nextPaymentDate null → null", () => {
    expect(nextDunningAction(POLICY, sub("active", null), nowAt(0))).toBeNull();
  });

  it("acepta now como cadena ISO", () => {
    expect(nextDunningAction(POLICY, sub("active"), dueAt(-20))).toEqual({
      kind: "reminder",
      template: "reminder-7",
      dueAt: dueAt(-7),
      offsetDays: -7,
    });
  });
});

// ---------- Registro de plantillas de email ----------

describe("plantillas de email", () => {
  it("welcome-code renderiza el código en la caja destacada con los colores de marca", () => {
    const html = getTemplate("welcome-code").html({ code: "ABC" });
    expect(html).toContain("ABC");
    expect(html).toContain("#1b5e3b");
    expect(html).toContain("#eef6f1");
  });

  it("receipt renderiza los datos del pago", () => {
    const html = getTemplate("receipt").html({
      producto: "Licencia PROMOB Pro",
      monto: "$ 12.500",
      fecha: "2026-09-21",
      medio: "Mercado Pago",
    });
    expect(html).toContain("Licencia PROMOB Pro");
    expect(html).toContain("$ 12.500");
    expect(html).toContain("Mercado Pago");
  });

  it("expone asunto y HTML para cada plantilla registrada", () => {
    expect(getTemplate("welcome-code").subject({})).toContain("código de activación");
    expect(getTemplate("receipt").subject({})).toContain("Comprobante de pago");
  });

  it("lanza en español para plantillas desconocidas y lista las disponibles", () => {
    expect(() => getTemplate("no-existe")).toThrowError(/Plantilla/);
    expect(() => getTemplate("no-existe")).toThrowError(/welcome-code/);
  });
});
