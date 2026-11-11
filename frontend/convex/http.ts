import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { api, internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

const http = httpRouter();

/** Computes the HMAC-SHA512 of `body` keyed with `secret`, as lowercase hex. */
async function hmacSha512Hex(secret: string, body: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time string comparison. */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return mismatch === 0;
}

/**
 * Convex Auth's own HTTP routes (OAuth callbacks, session management).
 */
auth.addHttpRoutes(http);

/**
 * Paystack payment webhook.
 *
 * Paystack signs the raw request body with HMAC-SHA512. We verify the
 * signature before touching any data, then settle the order.
 */
http.route({
  path: "/paystack/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const rawBody = await request.text();

    const secret = process.env.PAYSTACK_WEBHOOK_SECRET ?? process.env.PAYSTACK_SECRET_KEY;
    const signature = request.headers.get("x-paystack-signature");

    if (!secret || !signature) {
      return new Response("Missing signature", { status: 401 });
    }

    const expected = await hmacSha512Hex(secret, rawBody);

    if (!timingSafeEqualHex(expected, signature.trim().toLowerCase())) {
      return new Response("Invalid signature", { status: 401 });
    }

    let payload: {
      event?: string;
      data?: {
        status?: string;
        amount?: number;
        currency?: string;
        reference?: string;
        reason?: string;
        metadata?: { order_id?: string; buyer_id?: string; kind?: string } | null;
      };
    };

    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const data = payload.data;
    if (payload.event?.startsWith("transfer.")) {
      if (!data?.reference) {
        return new Response("Transfer reference is missing", { status: 400 });
      }
      try {
        const result = await ctx.runMutation(
          internal.functions.payouts.applyTransferWebhook,
          {
            reference: data.reference,
            event: payload.event,
            reason: data.reason,
          }
        );
        if ("ignored" in result && result.reason === "Payout reference not found") {
          return new Response("Transfer reference is not registered yet", { status: 503 });
        }
        return Response.json({ message: "Transfer event processed", result });
      } catch (error) {
        console.error("[paystack] failed to apply transfer event", error);
        return new Response(
          error instanceof Error ? error.message : "Failed to apply transfer event",
          { status: 500 }
        );
      }
    }

    if (payload.event !== "charge.success") {
      return new Response("Ignored", { status: 200 });
    }

    if (!data || data.status !== "success") {
      return new Response("Ignored", { status: 200 });
    }

    if (!data.reference || !data.amount || !data.currency || !data.metadata?.buyer_id) {
      return new Response("Payment metadata is incomplete", { status: 400 });
    }

    try {
      const result = await ctx.runMutation(internal.functions.payments.applyWebhookPayment, {
        reference: data.reference,
        amount: data.amount,
        currency: data.currency,
        order_id: data.metadata.order_id,
        buyer_id: data.metadata.buyer_id,
        kind: data.metadata.kind,
      });
      return Response.json({ message: "Payment applied", result });
    } catch (error) {
      console.error("[paystack] failed to apply payment", error);
      return new Response(
        error instanceof Error ? error.message : "Failed to apply payment",
        { status: 500 }
      );
    }
  }),
});

/**
 * Lightweight health probe. `?deep=1` also checks that the database answers.
 */
http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const deep = new URL(request.url).searchParams.get("deep") === "1";
    let database = "ok";

    if (deep) {
      try {
        await ctx.runQuery(api.functions.account.me);
      } catch {
        database = "unauthenticated";
      }
    }

    return Response.json({
      status: "ok",
      database,
      timestamp: new Date().toISOString(),
    }, {
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }),
});

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const uploadCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};
const reportFileCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};
const verificationCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

http.route({
  path: "/verification-upload",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: verificationCorsHeaders })),
});

http.route({
  path: "/verification-upload",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity
      ? await ctx.runQuery(internal.functions.verification.userIdForSubject, { subject: identity.subject })
      : null;
    if (!userId) {
      return Response.json({ error: "Sign in before submitting a verification document" }, {
        status: 401,
        headers: verificationCorsHeaders,
      });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const documentType = formData.get("document_type");
    if (!(file instanceof File)) {
      return Response.json({ error: "Choose a student ID or admission letter to upload" }, {
        status: 400,
        headers: verificationCorsHeaders,
      });
    }
    if (!["student_id", "admission_letter"].includes(String(documentType))) {
      return Response.json({ error: "Unsupported document type" }, {
        status: 400,
        headers: verificationCorsHeaders,
      });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return Response.json({ error: "File is larger than 5MB" }, {
        status: 413,
        headers: verificationCorsHeaders,
      });
    }
    if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type)) {
      return Response.json({ error: "Upload a PDF, JPEG, PNG, or WebP document" }, {
        status: 415,
        headers: verificationCorsHeaders,
      });
    }

    const storageId = await ctx.storage.store(file);
    try {
      const result = await ctx.runMutation(internal.functions.verification.submitUploadedDocument, {
        user_id: userId,
        document_type: String(documentType),
        storage_id: storageId,
        content_type: file.type,
      });
      return Response.json(result, { headers: verificationCorsHeaders });
    } catch (error) {
      await ctx.storage.delete(storageId);
      return Response.json(
        { error: error instanceof Error ? error.message : "Verification request could not be submitted" },
        { status: 400, headers: verificationCorsHeaders }
      );
    }
  }),
});

http.route({
  path: "/verification-document/:verificationId",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: verificationCorsHeaders })),
});

http.route({
  path: "/rider-application-upload",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: verificationCorsHeaders })),
});

http.route({
  path: "/rider-application-upload",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity
      ? await ctx.runQuery(internal.functions.delivery.userIdForSubject, { subject: identity.subject })
      : null;
    if (!userId) return Response.json({ error: "Sign in before applying to become a rider" }, { status: 401, headers: verificationCorsHeaders });
    const formData = await request.formData();
    const file = formData.get("document");
    const legalName = String(formData.get("legal_name") ?? "");
    const phone = String(formData.get("phone") ?? "");
    const studentIdNumber = String(formData.get("student_id_number") ?? "");
    if (!(file instanceof File)) return Response.json({ error: "Upload your student identification document" }, { status: 400, headers: verificationCorsHeaders });
    if (file.size > MAX_UPLOAD_BYTES) return Response.json({ error: "File is larger than 5MB" }, { status: 413, headers: verificationCorsHeaders });
    if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type)) {
      return Response.json({ error: "Upload a PDF, JPEG, PNG, or WebP document" }, { status: 415, headers: verificationCorsHeaders });
    }

    const storageId = await ctx.storage.store(file);
    try {
      const result = await ctx.runMutation(internal.functions.delivery.submitApplicationDocument, {
        user_id: userId, legal_name: legalName, phone, student_id_number: studentIdNumber,
        storage_id: storageId, content_type: file.type,
      });
      return Response.json(result, { headers: verificationCorsHeaders });
    } catch (error) {
      await ctx.storage.delete(storageId);
      return Response.json({ error: error instanceof Error ? error.message : "Rider application could not be submitted" }, { status: 400, headers: verificationCorsHeaders });
    }
  }),
});

http.route({
  path: "/rider-application-document/:applicationId",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: verificationCorsHeaders })),
});

http.route({
  path: "/rider-application-document/:applicationId",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const identity = await ctx.auth.getUserIdentity();
    const adminId = identity
      ? await ctx.runQuery(internal.functions.delivery.userIdForSubject, { subject: identity.subject })
      : null;
    if (!adminId) return new Response("Unauthorized", { status: 401, headers: verificationCorsHeaders });
    const applicationId = new URL(request.url).pathname.split("/").pop();
    if (!applicationId) return new Response("Not found", { status: 404, headers: verificationCorsHeaders });
    try {
      const document = await ctx.runQuery(internal.functions.delivery.riderDocumentContext, {
        application_id: applicationId, admin_id: adminId,
      });
      const file = await ctx.storage.get(document.storage_id);
      if (!file) return new Response("Not found", { status: 404, headers: verificationCorsHeaders });
      return new Response(file, {
        headers: {
          ...verificationCorsHeaders, "Content-Type": document.content_type,
          "Cache-Control": "private, no-store", "Content-Disposition": "inline",
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load rider document";
      return new Response(message, { status: message === "Admin access only" ? 403 : 404, headers: verificationCorsHeaders });
    }
  }),
});

http.route({
  path: "/verification-document/:verificationId",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity
      ? await ctx.runQuery(internal.functions.verification.userIdForSubject, { subject: identity.subject })
      : null;
    if (!userId) return new Response("Unauthorized", { status: 401, headers: verificationCorsHeaders });

    const verificationId = new URL(request.url).pathname.split("/").pop();
    if (!verificationId) return new Response("Not found", { status: 404, headers: verificationCorsHeaders });

    try {
      const document = await ctx.runQuery(internal.functions.verification.documentContext, {
        verification_id: verificationId,
        user_id: userId,
      });
      const file = await ctx.storage.get(document.storage_id);
      if (!file) return new Response("Not found", { status: 404, headers: verificationCorsHeaders });
      return new Response(file, {
        headers: {
          ...verificationCorsHeaders,
          "Content-Type": document.content_type,
          "Cache-Control": "private, no-store",
          "Content-Disposition": "inline",
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load verification document";
      const status = message === "Admin access only" ? 403 : 404;
      return new Response(message, { status, headers: verificationCorsHeaders });
    }
  }),
});

http.route({
  path: "/upload",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: uploadCorsHeaders })),
});

/**
 * Authenticated image upload. The caller must send the Convex Auth JWT in the
 * `Authorization` header.
 */
http.route({
  path: "/upload",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return new Response("Unauthorized", { status: 401, headers: uploadCorsHeaders });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return new Response("No file provided", { status: 400, headers: uploadCorsHeaders });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return new Response("File is larger than 5MB", { status: 413, headers: uploadCorsHeaders });
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return new Response("Only JPEG, PNG, WebP and GIF images are allowed", { status: 415, headers: uploadCorsHeaders });
    }

    const storageId = await ctx.storage.store(file);

    return Response.json({
      storageId,
      image_url: `${new URL(request.url).origin}/file/${storageId}`,
      contentType: file.type,
    }, { headers: uploadCorsHeaders });
  }),
});

http.route({
  path: "/report-upload",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: uploadCorsHeaders })),
});

http.route({
  path: "/report-upload",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return new Response("Sign in to attach a screenshot", { status: 401, headers: uploadCorsHeaders });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return new Response("No file provided", { status: 400, headers: uploadCorsHeaders });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return new Response("File is larger than 5MB", { status: 413, headers: uploadCorsHeaders });
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return new Response("Only JPEG, PNG, WebP and GIF images are allowed", { status: 415, headers: uploadCorsHeaders });
    }

    const storageId = await ctx.storage.store(file);
    return Response.json({
      image_url: `${new URL(request.url).origin}/report-file/${storageId}`,
    }, { headers: uploadCorsHeaders });
  }),
});

http.route({
  path: "/report-file/:storageId",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: reportFileCorsHeaders })),
});

http.route({
  path: "/report-file/:storageId",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    if (!await ctx.auth.getUserIdentity()) {
      return new Response("Unauthorized", { status: 401, headers: reportFileCorsHeaders });
    }
    const account = await ctx.runQuery(api.functions.account.me, {});
    if (account.user.role !== "admin") {
      return new Response("Admin access only", { status: 403, headers: reportFileCorsHeaders });
    }

    const storageId = new URL(request.url).pathname.split("/report-file/")[1];
    if (!storageId) {
      return new Response("Not found", { status: 404, headers: reportFileCorsHeaders });
    }
    const file = await ctx.storage.get(storageId as Id<"_storage">);
    if (!file) {
      return new Response("Not found", { status: 404, headers: reportFileCorsHeaders });
    }
    return new Response(file, {
      headers: {
        ...reportFileCorsHeaders,
        "Content-Type": file.type || "application/octet-stream",
        "Cache-Control": "private, no-store",
      },
    });
  }),
});

/** Serves a file out of Convex file storage. */
http.route({
  path: "/file/:storageId",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  })),
});

http.route({
  path: "/file/:storageId",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const storageId = new URL(request.url).pathname.split("/file/")[1];
    if (!storageId) {
      return new Response("Not found", {
        status: 404,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    const file = await ctx.storage.get(storageId);
    if (file === null) {
      return new Response("Not found", {
        status: 404,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    return new Response(file, { headers: { "Access-Control-Allow-Origin": "*" } });
  }),
});

export default http;
