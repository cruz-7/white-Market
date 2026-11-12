import { describe, expect, it } from "vitest";
import {
  releaseOneUnit,
  reserveOneUnit,
  validateStockQuantity,
} from "../convex/lib/inventory";

describe("tracked product stock", () => {
  it("reserves one available unit from the product count", () => {
    expect(reserveOneUnit(3)).toBe(2);
    expect(reserveOneUnit(1)).toBe(0);
  });

  it("rejects checkout for missing, zero, or invalid tracked quantities", () => {
    expect(() => reserveOneUnit(undefined)).toThrow("set available stock");
    expect(() => reserveOneUnit(0)).toThrow("out of stock");
    expect(() => reserveOneUnit(-1)).toThrow("non-negative whole number");
    expect(() => reserveOneUnit(1.5)).toThrow("non-negative whole number");
  });

  it("restores a reserved unit once when the pending order is cancelled", () => {
    expect(releaseOneUnit(0, true)).toBe(1);
    expect(releaseOneUnit(4, false)).toBe(4);
    expect(releaseOneUnit(4, undefined)).toBe(4);
  });

  it("validates quantities at product create and update boundaries", () => {
    expect(() => validateStockQuantity(0)).not.toThrow();
    expect(() => validateStockQuantity(2)).not.toThrow();
    expect(() => validateStockQuantity(-1)).toThrow();
    expect(() => validateStockQuantity(2.5)).toThrow();
  });
});
