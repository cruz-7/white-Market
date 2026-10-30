import { getAuthUserId } from "@convex-dev/auth/server";
import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";

export type AnyCtx = QueryCtx | MutationCtx;
export type AuthCtx = AnyCtx | ActionCtx;

/**
 * Returns the signed-in user's id, or throws.
 *
 * Convex has no per-route middleware, so every query and mutation that touches
 * user data calls this first.
 */
export async function requireUserId(ctx: AuthCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Not authenticated");
  }
  if (!(await isActiveUser(ctx, userId))) {
    throw new Error("This account has been deleted");
  }
  return userId;
}

/** Same as `requireUserId` but returns null instead of throwing. */
export async function optionalUserId(ctx: AuthCtx): Promise<Id<"users"> | null> {
  const userId = (await getAuthUserId(ctx)) ?? null;
  if (!userId) return null;
  return (await isActiveUser(ctx, userId)) ? userId : null;
}

async function isActiveUser(ctx: AuthCtx, userId: Id<"users">): Promise<boolean> {
  if ("db" in ctx) {
    const profile = await ctx.db.get(userId);
    return !!profile && !profile.account_deleted_at;
  }
  return ctx.runQuery(internal.functions.profile.assertActiveUser, { user_id: userId });
}

export async function requireProfile(
  ctx: AnyCtx,
  userId?: Id<"users">
): Promise<Doc<"users">> {
  const id = userId ?? (await requireUserId(ctx));
  const profile = await ctx.db.get(id);
  if (!profile) {
    throw new Error("User profile not found");
  }
  if (profile.role === "banned") {
    throw new Error("Account is banned");
  }
  return profile;
}

export async function requireAdmin(ctx: AnyCtx): Promise<Doc<"users">> {
  const profile = await requireProfile(ctx);
  if (profile.role !== "admin") {
    throw new Error("Admin access only");
  }
  return profile;
}

export function isAdmin(profile: Doc<"users"> | null | undefined): boolean {
  return profile?.role === "admin";
}

export function isBanned(profile: Doc<"users"> | null | undefined): boolean {
  return profile?.role === "banned";
}

/** The public shape of a user, as consumed by the frontend. */
export function userSummary(user: Doc<"users"> | null | undefined) {
  if (!user) return undefined;
  return {
    id: user._id,
    full_name: user.full_name ?? user.name ?? "",
    email: user.email ?? "",
    avatar_url: user.avatar_url ?? user.image ?? null,
    verified: user.verified ?? false,
    seller_display_name: user.seller_display_name ?? null,
    seller_profile_image_url: user.seller_profile_image_url ?? null,
    campus: user.campus ?? null,
    role: user.role ?? "user",
  };
}
