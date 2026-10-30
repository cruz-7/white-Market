import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireProfile, requireUserId } from "../lib/auth";
import { toIso } from "../lib/shapes";

const SCHOOL_DOMAINS = ["st.ug.edu.gh", "ug.edu.gh"];

export function isSchoolEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const domain = email.split("@")[1]?.toLowerCase();
  return !!domain && SCHOOL_DOMAINS.includes(domain);
}

export const status = query({
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const user = await requireProfile(ctx, userId);

    const verifications = await ctx.db
      .query("verifications")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .collect();
    const latest = verifications.sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0))[0];
    const schoolEmail = isSchoolEmail(user.email);

    return {
      verified: (user.verified ?? false) || schoolEmail,
      verification_status:
        latest?.status ?? (schoolEmail ? "approved" : user.verification_status ?? "none"),
      document_type: latest?.document_type,
      created_at: toIso(latest?.created_at),
      is_school_email: schoolEmail,
    };
  },
});

export const request = mutation({
  args: {
    document_type: v.string(),
    document_url: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const user = await requireProfile(ctx, userId);

    if (!["student_id", "admission_letter"].includes(args.document_type)) {
      throw new Error("Unsupported document type");
    }

    const verifications = await ctx.db
      .query("verifications")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .collect();

    if (verifications.some((verification) => verification.status === "pending")) {
      throw new Error("You already have a verification request under review");
    }
    if (user.verified) {
      throw new Error("You are already verified");
    }

    const now = Date.now();

    // Students with a university email are verified automatically.
    if (isSchoolEmail(user.email)) {
      await ctx.db.patch(userId, {
        verified: true,
        verification_status: "approved",
        updated_at: now,
      });
      return {
        message: "Verification approved instantly for your student email",
        status: "approved",
        verified: true,
      };
    }

    const verificationId = await ctx.db.insert("verifications", {
      user_id: userId,
      document_type: args.document_type,
      document_url: args.document_url,
      status: "pending",
      created_at: now,
      updated_at: now,
    });

    await ctx.db.patch(userId, {
      verification_status: "pending",
      updated_at: now,
    });

    return {
      message: "Verification request submitted for review",
      verification_id: verificationId,
      status: "pending",
      verified: false,
    };
  },
});

export const listPending = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const admin = await requireProfile(ctx, userId);
    if (admin.role !== "admin") throw new Error("Admin access only");

    const statusFilter = args.status ?? "pending";
    const all = await ctx.db
      .query("verifications")
      .withIndex("by_status", (q) => q.eq("status", statusFilter))
      .collect();

    const results = await Promise.all(
      all.map(async (verification) => {
        const user = await ctx.db.get(verification.user_id);
        return {
          id: verification._id,
          user_id: verification.user_id,
          document_type: verification.document_type,
          document_url: verification.document_url,
          status: verification.status,
          rejection_reason: verification.rejection_reason,
          created_at: toIso(verification.created_at),
          updated_at: toIso(verification.updated_at),
          user: user
            ? {
                id: user._id,
                email: user.email ?? "",
                full_name: user.full_name ?? user.name ?? "",
                verification_status: user.verification_status ?? "none",
              }
            : undefined,
        };
      })
    );

    return { verifications: results };
  },
});

export const approve = mutation({
  args: { id: v.id("verifications") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const admin = await requireProfile(ctx, userId);
    if (admin.role !== "admin") throw new Error("Admin access only");

    const verification = await ctx.db.get(args.id);
    if (!verification) throw new Error("Verification not found");
    if (verification.status !== "pending") {
      throw new Error(`Verification is already ${verification.status}`);
    }

    const now = Date.now();
    await ctx.db.patch(args.id, {
      status: "approved",
      reviewed_by: userId,
      updated_at: now,
    });
    await ctx.db.patch(verification.user_id, {
      verified: true,
      verification_status: "approved",
      updated_at: now,
    });
    await ctx.db.insert("notifications", {
      user_id: verification.user_id,
      type: "verification_approved",
      title: "Student verified",
      body: "Your student verification was approved.",
      data: { verification_id: args.id },
      read: false,
      created_at: now,
    });

    return { message: "Verification approved", verification_id: args.id, status: "approved" };
  },
});

export const reject = mutation({
  args: { id: v.id("verifications"), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const admin = await requireProfile(ctx, userId);
    if (admin.role !== "admin") throw new Error("Admin access only");

    const verification = await ctx.db.get(args.id);
    if (!verification) throw new Error("Verification not found");
    if (verification.status !== "pending") {
      throw new Error(`Verification is already ${verification.status}`);
    }

    const now = Date.now();
    await ctx.db.patch(args.id, {
      status: "rejected",
      reviewed_by: userId,
      rejection_reason: args.reason,
      updated_at: now,
    });
    await ctx.db.patch(verification.user_id, {
      verified: false,
      verification_status: "rejected",
      updated_at: now,
    });
    await ctx.db.insert("notifications", {
      user_id: verification.user_id,
      type: "verification_rejected",
      title: "Verification rejected",
      body: args.reason ?? "Your student verification was rejected.",
      data: { verification_id: args.id },
      read: false,
      created_at: now,
    });

    return { message: "Verification rejected", verification_id: args.id, status: "rejected" };
  },
});
