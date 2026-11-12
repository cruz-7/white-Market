import { describe, expect, it } from "vitest";
import { requirePaystackSecretKey } from "../convex/lib/paystackMode";

describe("Paystack deployment mode", () => {
  it("allows test keys only on development deployments", () => {
    expect(requirePaystackSecretKey("sk_test_example", "dev:quirky-owl-185")).toBe(
      "sk_test_example"
    );
    expect(requirePaystackSecretKey("sk_test_example", "local:local-deployment")).toBe(
      "sk_test_example"
    );
    expect(() =>
      requirePaystackSecretKey("sk_live_example", "dev:quirky-owl-185")
    ).toThrow("Paystack test mode");
  });

  it("allows live keys only on production deployments", () => {
    expect(
      requirePaystackSecretKey("sk_live_example", "prod:necessary-kingfisher-673")
    ).toBe("sk_live_example");
    expect(() =>
      requirePaystackSecretKey("sk_test_example", "prod:necessary-kingfisher-673")
    ).toThrow("Paystack live mode");
  });

  it("rejects a missing key or unknown deployment mode", () => {
    expect(() => requirePaystackSecretKey(undefined, "dev:quirky-owl-185")).toThrow(
      "PAYSTACK_SECRET_KEY is not configured"
    );
    expect(() => requirePaystackSecretKey("sk_test_example", "preview:deployment")).toThrow(
      "Cannot determine the Paystack mode"
    );
  });
});
