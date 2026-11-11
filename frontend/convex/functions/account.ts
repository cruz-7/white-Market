import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import { action, internalQuery, mutation, query } from "../_generated/server";
import { modifyAccountCredentials } from "@convex-dev/auth/server";
import { isVerifiedStudent, requireProfile, requireUserId } from "../lib/auth";
import type { Id } from "../_generated/dataModel";

export const passwordContext = internalQuery({
  args: { user_id: v.id("users") },
  handler: async (ctx, args): Promise<{ email: string }> => {
    const user = await ctx.db.get(args.user_id);
    if (!user || !user.email) throw new Error("Your account has no email address");
    return { email: user.email };
  },
});

/**
 * Changes the signed-in user's password.
 *
 * The current password is verified by attempting a password sign-in first;
 * Convex Auth then stores the new secret on the account.
 */
export const changePassword = action({
  args: {
    current_password: v.string(),
    new_password: v.string(),
  },
  handler: async (ctx, args): Promise<{ message: string; user: { id: Id<"users">; email: string } }> => {
    const userId = await requireUserId(ctx);
    const profile = await ctx.runQuery(internal.functions.account.passwordContext, { user_id: userId });
    if (args.current_password === args.new_password) {
      throw new Error("The new password must be different from the current one");
    }

    try {
      await ctx.runAction(api.auth.signIn, {
        provider: "password",
        params: {
          email: profile.email,
          password: args.current_password,
          flow: "signIn",
        },
      });
    } catch {
      throw new Error("Your current password is incorrect");
    }

    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: { id: profile.email, secret: args.new_password },
    });

    return {
      message: "Password changed successfully",
      user: { id: userId, email: profile.email },
    };
  },
});

/** Admin confirms a user's email address. */
export const confirmEmail = mutation({
  args: { user_id: v.optional(v.id("users")), email: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const admin = await requireProfile(ctx, userId);
    if (admin.role !== "admin") throw new Error("Admin access only");

    const targetId = args.user_id
      ? args.user_id
      : await (async () => {
          const email = args.email?.trim().toLowerCase();
          if (!email) throw new Error("A user id or email is required");
          const match = await ctx.db
            .query("users")
            .withIndex("email", (q) => q.eq("email", email))
            .unique();
          if (!match) throw new Error("User not found");
          return match._id;
        })();

    await ctx.db.patch(targetId, { emailVerificationTime: Date.now() });
    return { message: "Email confirmed", user_id: targetId, status: "confirmed" };
  },
});

/** The signed-in user's own identity, used by the frontend to hydrate state. */
export const me = query({
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const user = await requireProfile(ctx, userId);
    return {
      message: "Authenticated",
      user: {
        id: user._id,
        email: user.email ?? "",
        role: user.role ?? "user",
        full_name: user.full_name ?? user.name ?? "",
        verified: await isVerifiedStudent(ctx, userId),
        avatar_url: user.avatar_url ?? user.image ?? null,
      },
    };
  },
});
