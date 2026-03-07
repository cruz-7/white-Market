import { Router } from "express";
import { supabase } from "../lib/supabaseClient.js";
import { requireAuth } from "../middleware/requireAuth.js";

const messagesRouter = Router();

async function getConversationForUser(conversationId, userId) {
  const { data: conversation, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .single();

  if (error || !conversation) {
    return { ok: false, status: 404, error: "Conversation not found" };
  }

  const isParticipant = conversation.buyer_id === userId || conversation.seller_id === userId;
  if (!isParticipant) {
    return { ok: false, status: 403, error: "Not allowed to access this conversation" };
  }

  return { ok: true, conversation };
}

messagesRouter.get("/conversations", requireAuth, async (req, res) => {
  const { data: conversations, error } = await supabase
    .from("conversations")
    .select("id, product_id, buyer_id, seller_id, updated_at")
    .or(`buyer_id.eq.${req.user.id},seller_id.eq.${req.user.id}`)
    .order("updated_at", { ascending: false });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  const list = conversations || [];
  if (list.length === 0) {
    return res.json({ conversations: [] });
  }

  const productIds = Array.from(new Set(list.map((item) => item.product_id).filter(Boolean)));
  const participantIds = Array.from(
    new Set(list.flatMap((item) => [item.buyer_id, item.seller_id]).filter(Boolean)),
  );
  const conversationIds = list.map((item) => item.id);

  const [{ data: products }, { data: users }, { data: allMessages }] = await Promise.all([
    productIds.length
      ? supabase.from("products").select("id, title, image_url").in("id", productIds)
      : Promise.resolve({ data: [] }),
    participantIds.length
      ? supabase.from("users").select("id, full_name").in("id", participantIds)
      : Promise.resolve({ data: [] }),
    conversationIds.length
      ? supabase
          .from("messages")
          .select("id, conversation_id, sender_id, text, image_url, created_at, status")
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const productsById = new Map((products || []).map((item) => [item.id, item]));
  const usersById = new Map((users || []).map((item) => [item.id, item]));
  const messagesByConversation = new Map();

  for (const message of allMessages || []) {
    if (!messagesByConversation.has(message.conversation_id)) {
      messagesByConversation.set(message.conversation_id, []);
    }
    messagesByConversation.get(message.conversation_id).push(message);
  }

  const payload = list.map((conversation) => {
    const product = productsById.get(conversation.product_id);
    const buyer = usersById.get(conversation.buyer_id);
    const seller = usersById.get(conversation.seller_id);
    const messages = messagesByConversation.get(conversation.id) || [];
    const lastMessage = messages[0] || null;
    const unread = messages.filter((msg) => msg.sender_id !== req.user.id && msg.status !== "read").length;

    return {
      id: conversation.id,
      product_id: conversation.product_id,
      product_title: product?.title || "Product",
      product_image_url: product?.image_url || "",
      buyer_id: conversation.buyer_id,
      seller_id: conversation.seller_id,
      buyer_name: buyer?.full_name || "Buyer",
      seller_name: seller?.full_name || "Seller",
      updated_at: conversation.updated_at,
      last_message: lastMessage,
      unread_count: unread,
    };
  });

  return res.json({ conversations: payload });
});

messagesRouter.get("/conversations/:id/messages", requireAuth, async (req, res) => {
  const conversationResult = await getConversationForUser(req.params.id, req.user.id);
  if (!conversationResult.ok) {
    return res.status(conversationResult.status).json({ error: conversationResult.error });
  }

  const { conversation } = conversationResult;

  const { data: messages, error } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, text, image_url, created_at, status")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  await supabase
    .from("messages")
    .update({ status: "read" })
    .eq("conversation_id", conversation.id)
    .neq("sender_id", req.user.id)
    .neq("status", "read");

  return res.json({ messages: messages || [] });
});

messagesRouter.post("/conversations/upsert", requireAuth, async (req, res) => {
  const { product_id, buyer_id } = req.body || {};
  if (!product_id) {
    return res.status(400).json({ error: "product_id is required" });
  }

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, seller_id")
    .eq("id", product_id)
    .single();

  if (productError || !product) {
    return res.status(404).json({ error: "Product not found" });
  }

  let targetBuyerId = req.user.id;
  let targetSellerId = product.seller_id;

  if (req.user.id === product.seller_id) {
    if (!buyer_id) {
      return res.status(400).json({ error: "buyer_id is required when seller starts a conversation" });
    }
    targetBuyerId = buyer_id;
    targetSellerId = req.user.id;
  }

  if (targetBuyerId === targetSellerId) {
    return res.status(400).json({ error: "Buyer and seller cannot be the same user" });
  }

  const { data: conversation, error } = await supabase
    .from("conversations")
    .upsert(
      {
        product_id,
        buyer_id: targetBuyerId,
        seller_id: targetSellerId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "product_id,buyer_id,seller_id" },
    )
    .select("*")
    .single();

  if (error || !conversation) {
    return res.status(400).json({ error: error?.message || "Failed to create conversation" });
  }

  return res.json({ conversation });
});

messagesRouter.post("/", requireAuth, async (req, res) => {
  const { conversation_id, text, image_url } = req.body || {};

  if (!conversation_id) {
    return res.status(400).json({ error: "conversation_id is required" });
  }
  if (!text && !image_url) {
    return res.status(400).json({ error: "text or image_url is required" });
  }

  const conversationResult = await getConversationForUser(conversation_id, req.user.id);
  if (!conversationResult.ok) {
    return res.status(conversationResult.status).json({ error: conversationResult.error });
  }

  const { data: message, error } = await supabase
    .from("messages")
    .insert({
      conversation_id,
      sender_id: req.user.id,
      text: text || null,
      image_url: image_url || null,
      status: "sent",
    })
    .select("*")
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversation_id);

  return res.status(201).json({ message });
});

export default messagesRouter;
