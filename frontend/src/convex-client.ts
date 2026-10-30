import { ConvexReactClient } from "convex/react";

const convexUrl = import.meta.env.VITE_CONVEX_URL;

/**
 * Bridge between the Convex Auth React hooks and the plain TypeScript API
 * layer in `api.ts`.
 *
 * Convex Auth only persists the session token when the sign-in runs through
 * `useAuthActions().signIn`, so the API layer cannot call the auth action on
 * its own without ending up with an unauthenticated client.
 */
export interface ConvexAuthBridge {
  signIn: (
    provider: string,
    params?: Record<string, unknown>
  ) => Promise<{ signingIn: boolean; redirect?: URL }>;
  signOut: () => Promise<void>;
  /** Makes the Convex client use the freshly issued token right away. */
  refreshClientAuth: () => void;
}

let authBridge: ConvexAuthBridge | null = null;

export function registerConvexAuthBridge(bridge: ConvexAuthBridge | null) {
  authBridge = bridge;
}

export function getConvexAuthBridge(): ConvexAuthBridge {
  if (!authBridge) {
    throw new Error("Convex Auth is still starting up. Please try again.");
  }
  return authBridge;
}

if (!convexUrl) {
  throw new Error(
    "VITE_CONVEX_URL is not set. Run `npx convex dev` to link this project, " +
      "then copy the deployment URL into frontend/.env"
  );
}

export const convex = new ConvexReactClient(convexUrl as string);

/**
 * The Convex Auth access token, as persisted by `ConvexAuthProvider`.
 *
 * Convex Auth namespaces its localStorage keys with the deployment URL, so the
 * key looks like `__convexAuthJWT_httpsxyzconvexdev`. We look it up by prefix
 * so the exact deployment URL does not have to be hard-coded here.
 */
export function convexAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const direct = window.localStorage.getItem(
      `__convexAuthJWT_${(convexUrl as string).replace(/[^a-zA-Z0-9]/g, "")}`
    );
    if (direct) return direct;

    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key && key.startsWith("__convexAuthJWT_")) {
        return window.localStorage.getItem(key);
      }
    }
  } catch {
    return null;
  }
  return null;
}
