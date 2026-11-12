import { describe, expect, it } from "vitest";
import { getPaymentInfo } from "./order-display";

describe("order payment display", () => {
  it("shows the recorded card payment method", () => {
    expect(getPaymentInfo("card").label).toBe("Card payment");
  });

  it("shows the recorded wallet payment method", () => {
    expect(getPaymentInfo("wallet").label).toBe("Wallet payment");
  });

  it("does not invent a payment method when the order has none", () => {
    expect(getPaymentInfo(undefined)).toEqual({
      label: "Payment method not recorded",
      color: "text-gray-500",
    });
    expect(getPaymentInfo("unknown").label).toBe("Payment method not recorded");
  });
});
