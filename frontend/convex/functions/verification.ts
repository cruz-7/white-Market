import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "../_generated/server";
import { isVerifiedStudent, requireProfile, requireUserId } from "../lib/auth";
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
    const verified = await isVerifiedStudent(ctx, userId);
    const verificationStatus = verified
      ? "approved"
      : latest?.status === "approved" || (!latest && user.verification_status === "approved")
        ? "none"
        : latest?.status ?? user.verification_status ?? "none";

    return {
      verified,
      verification_status: verificationStatus,
      document_type: latest?.document_type,
      created_at: toIso(latest?.created_at),
      is_school_email: schoolEmail,
    };
  },
});

export const submitUploadedDocument = internalMutation({
  args: {
    user_id: v.id("users"),
    document_type: v.string(),
    storage_id: v.id("_storage"),
    content_type: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireProfile(ctx, args.user_id);

    if (!["student_id", "admission_letter"].includes(args.document_type)) {
      throw new Error("Unsupported document type");
    }

    const verifications = await ctx.db
      .query("verifications")
      .withIndex("by_user", (q) => q.eq("user_id", args.user_id))
      .collect();

    if (verifications.some((verification) => verification.status === "pending")) {
      throw new Error("You already have a verification request under review");
    }
    if (
      user.verified &&
      verifications.some((verification) => verification.status === "approved")
    ) {
      throw new Error("You are already verified");
    }

    const now = Date.now();
    const verificationId = await ctx.db.insert("verifications", {
      user_id: args.user_id,
      document_type: args.document_type,
      document_storage_id: args.storage_id,
      document_content_type: args.content_type,
      status: "pending",
      created_at: now,
      updated_at: now,
    });

    await ctx.db.patch(args.user_id, {
      verified: false,
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

export const documentContext = internalQuery({
  args: { verification_id: v.string(), user_id: v.id("users") },
  handler: async (ctx, args) => {
    const admin = await ctx.db.get(args.user_id);
    if (!admin || admin.role !== "admin") throw new Error("Admin access only");
    const verificationId = ctx.db.normalizeId("verifications", args.verification_id);
    if (!verificationId) throw new Error("Verification not found");
    const verification = await ctx.db.get(verificationId);
    if (!verification?.document_storage_id) throw new Error("Verification document not found");
    return {
      storage_id: verification.document_storage_id,
      content_type: verification.document_content_type ?? "application/octet-stream",
    };
  },
});

export const userIdForSubject = internalQuery({
  args: { subject: v.string() },
  handler: async (ctx, args) => ctx.db.normalizeId("users", args.subject),
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
          has_document: Boolean(verification.document_storage_id),
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
    if (!verification.document_storage_id) {
      throw new Error("This verification request has no uploaded student document");
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
