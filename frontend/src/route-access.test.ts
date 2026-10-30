import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { adminRouteRedirect, appRoutes, dashboardDestination } from "./route-access";

describe("registered app routes", () => {
  const appSource = readFileSync(fileURLToPath(new URL("./App.tsx", import.meta.url)), "utf8");

  it.each([
    ["home", "/"],
    ["marketplace", "/marketplace"],
    ["checkout", "/checkout/:orderId"],
    ["paymentCallback", "/payment/callback"],
    ["admin", "/admin"],
    ["fashion", "/fashion"],
    ["fashionListing", "/fashion/:id"],
    ["books", "/books-and-notes"],
    ["bookListing", "/books-and-notes/:id"],
    ["report", "/report"],
  ] as const)("registers %s at %s", (key, path) => {
    expect(appRoutes[key]).toBe(path);
    expect(appSource).toContain(`path={appRoutes.${key}}`);
  });
});

describe("admin route authorization", () => {
  it("sends signed-out visitors to authentication", () => {
    expect(adminRouteRedirect(false, "admin")).toBe("/auth");
  });

  it.each(["user", "seller", "banned", "deleted", undefined])(
    "denies non-admin role %s",
    (role) => {
      expect(adminRouteRedirect(true, role)).toBe("/marketplace");
    }
  );

  it("allows an authenticated admin", () => {
    expect(adminRouteRedirect(true, "admin")).toBeNull();
  });
});

describe("dashboard role routing", () => {
  it("routes signed-out visitors to login", () => {
    expect(dashboardDestination(false, "seller")).toBe("/auth");
  });

  it("routes admins and sellers to their respective dashboards", () => {
    expect(dashboardDestination(true, "admin")).toBe("/admin");
    expect(dashboardDestination(true, "seller")).toBe("seller");
  });

  it("routes regular users to the student dashboard", () => {
    expect(dashboardDestination(true, "user")).toBe("student");
  });
});
