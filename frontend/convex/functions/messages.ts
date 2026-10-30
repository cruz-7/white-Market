import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireProfile, requireUserId } from "../lib/auth";
import { toIso } from "../lib/shapes";

export const conversations = query({
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    await requireProfile(ctx, userId);

    const asBuyer = await ctx.db
      .query("conversations")
      .withIndex("by_buyer", (q) => q.eq("buyer_id", userId))
      .collect();
    const asSeller = await ctx.db
      .query("conversations")
      .withIndex("by_seller", (q) => q.eq("seller_id", userId))
      .collect();

    const all = [...asBuyer, ...asSeller];
    const unique = [...new Map(all.map((c) => [c._id, c])).values()];

    const results = await Promise.all(
      unique.map(async (conversation) => {
        const product = conversation.product_id
          ? await ctx.db.get(conversation.product_id)
          : null;
        const buyer = await ctx.db.get(conversation.buyer_id);
        const seller = await ctx.db.get(conversation.seller_id);
        const messages = await ctx.db
          .query("messages")
          .withIndex("by_conversation", (q) => q.eq("conversation_id", conversation._id))
          .collect();

        const lastMessage = messages.sort(
          (a, b) => (b.created_at ?? 0) - (a.created_at ?? 0)
        )[0];

        return {
          id: conversation._id,
          product_id: conversation.product_id,
          product_title: product?.title ?? "",
          product_image_url: product?.image_url ?? "",
          buyer_id: conversation.buyer_id,
          seller_id: conversation.seller_id,
          buyer_name: buyer?.full_name ?? buyer?.name ?? "",
          seller_name: seller?.full_name ?? seller?.name ?? "",
          updated_at: toIso(conversation.updated_at),
          unread_count: messages.filter(
            (m) => m.sender_id !== userId && m.status !== "read"
          ).length,
          last_message: lastMessage
            ? {
                id: lastMessage._id,
                text: lastMessage.text,
                image_url: lastMessage.image_url,
                created_at: toIso(lastMessage.created_at),
                sender_id: lastMessage.sender_id,
              }
            : null,
        };
      })
    );

    return {
      conversations: results.sort(
        (a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? "")
      ),
    };
  },
});

export const messages = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireProfile(ctx, userId);

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");
    if (conversation.buyer_id !== userId && conversation.seller_id !== userId) {
      throw new Error("Not authorized to view this conversation");
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversation_id", args.conversationId))
      .collect();

    return {
      messages: messages
        .sort((a, b) => (a.created_at ?? 0) - (b.created_at ?? 0))
        .map((message) => ({
          id: message._id,
          conversation_id: message.conversation_id,
          sender_id: message.sender_id,
          receiver_id: message.receiver_id,
          text: message.text,
          image_url: message.image_url,
          status: message.status === "read" || message.status === "delivered"
            ? message.status
            : "sent",
          created_at: toIso(message.created_at) ?? new Date().toISOString(),
        })),
    };
  },
});

/** Finds (or creates) the conversation between the current user and a seller. */
export const upsert = mutation({
  args: { product_id: v.id("products"), buyer_id: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireProfile(ctx, userId);

    const product = await ctx.db.get(args.product_id);
    if (!product) throw new Error("Product not found");

    const isSeller = product.seller_id === userId;
    const buyerId = isSeller ? args.buyer_id : userId;
    if (!buyerId) {
      throw new Error("A buyer is required to start this conversation");
    }
    if (isSeller && buyerId === userId) {
      throw new Error("You cannot start a conversation with yourself");
    }

    const existing = (
      await ctx.db
        .query("conversations")
        .withIndex("by_buyer", (q) => q.eq("buyer_id", buyerId))
        .collect()
    ).find(
      (conversation) =>
        conversation.seller_id === product.seller_id &&
        conversation.product_id === product._id
    );

    if (existing) {
      const updatedAt = Date.now();
      await ctx.db.patch(existing._id, { updated_at: updatedAt });
      return {
        conversation: {
          id: existing._id,
          product_id: existing.product_id,
          buyer_id: existing.buyer_id,
          seller_id: existing.seller_id,
          updated_at: new Date(updatedAt).toISOString(),
        },
      };
    }

    const now = Date.now();
    const conversationId = await ctx.db.insert("conversations", {
      product_id: product._id,
      buyer_id: buyerId,
      seller_id: product.seller_id,
      created_at: now,
      updated_at: now,
    });

    const conversation = await ctx.db.get(conversationId);
    return {
      conversation: {
        id: conversationId,
        product_id: args.product_id,
        buyer_id: buyerId,
        seller_id: product.seller_id,
        updated_at: new Date(now).toISOString(),
      },
    };
  },
});

export const send = mutation({
  args: {
    conversation_id: v.id("conversations"),
    text: v.optional(v.string()),
    image_url: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireProfile(ctx, userId);

    const conversation = await ctx.db.get(args.conversation_id);
    if (!conversation) throw new Error("Conversation not found");
    if (conversation.buyer_id !== userId && conversation.seller_id !== userId) {
      throw new Error("Not authorized to post in this conversation");
    }

    const text = args.text?.trim();
    if (!text && !args.image_url) {
      throw new Error("A message needs text or an image");
    }

    const receiverId =
      conversation.buyer_id === userId ? conversation.seller_id : conversation.buyer_id;

    const now = Date.now();
    const messageId = await ctx.db.insert("messages", {
      conversation_id: conversation._id,
      sender_id: userId,
      receiver_id: receiverId,
      text,
      image_url: args.image_url,
      status: "sent",
      created_at: now,
    });

    await ctx.db.patch(conversation._id, {
      updated_at: now,
      last_message_id: messageId,
      last_message_at: now,
    });

    await ctx.db.insert("notifications", {
      user_id: receiverId,
      type: "message_received",
      title: "New message",
      body: text ?? "Sent you an image",
      data: { conversation_id: conversation._id },
      read: false,
      created_at: now,
    });

    const message = await ctx.db.get(messageId);
    return {
      message: {
        id: messageId,
        conversation_id: conversation._id,
        sender_id: userId,
        receiver_id: receiverId,
        text,
        image_url: args.image_url,
        status: "sent" as const,
        created_at: new Date(now).toISOString(),
      },
    };
  },
});

/** Marks every message in a conversation as read by the current user. */
export const markRead = mutation({
  args: { conversation_id: v.id("conversations") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const conversation = await ctx.db.get(args.conversation_id);
    if (!conversation) throw new Error("Conversation not found");
    if (conversation.buyer_id !== userId && conversation.seller_id !== userId) {
      throw new Error("Not authorized");
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversation_id", args.conversation_id))
      .collect();

    const now = Date.now();
    for (const message of messages) {
      if (message.sender_id !== userId && message.status !== "read") {
        await ctx.db.patch(message._id, { status: "read", read_at: now });
      }
    }

    return { message: "Messages marked as read" };
  },
});
