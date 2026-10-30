export const appRoutes = {
  home: "/",
  marketplace: "/marketplace",
  checkout: "/checkout/:orderId",
  paymentCallback: "/payment/callback",
  admin: "/admin",
  fashion: "/fashion",
  fashionListing: "/fashion/:id",
  books: "/books-and-notes",
  bookListing: "/books-and-notes/:id",
  report: "/report",
} as const;

export type AppRole = "admin" | "seller" | "user" | "banned" | "deleted" | string;

export function adminRouteRedirect(
  isAuthenticated: boolean,
  role?: AppRole
): "/auth" | "/marketplace" | null {
  if (!isAuthenticated) return "/auth";
  if (role !== "admin") return "/marketplace";
  return null;
}

export function dashboardDestination(
  isAuthenticated: boolean,
  role?: AppRole
): "/auth" | "/admin" | "seller" | "student" {
  if (!isAuthenticated) return "/auth";
  if (role === "admin") return "/admin";
  if (role === "seller") return "seller";
  return "student";
}
