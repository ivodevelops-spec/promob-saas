// tests/state-machine.test.ts — guards puros de la máquina de estados.
import { describe, expect, it } from "vitest";
import {
  CODE_POOL_STATUSES,
  isCodePoolStatus,
  isOrderStatus,
  isSubscriptionStatus,
  ORDER_STATUSES,
  SUBSCRIPTION_STATUSES,
} from "../src/state-machine";

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
});
