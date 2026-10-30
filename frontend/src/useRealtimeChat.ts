import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api as convexApi } from "../convex/_generated/api";

export interface DirectMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface UseRealtimeChatOptions {
  currentUserId: string;
  otherUserId: string;
}

/**
 * Hook for real-time direct messaging between two users
 * Uses the simpler sender_id/receiver_id message structure
 */
export function useRealtimeChat({ currentUserId, otherUserId }: UseRealtimeChatOptions) {
  const [sending, setSending] = useState(false);

  // The frontend uses the conversations/messages API surface now; this hook
  // remains for backward compatibility but delegates to Convex data.
  const conversations = useQuery((convexApi as any).messages.conversations);
  const conversation = conversations?.conversations?.find(
    (c: any) =>
      (c.buyer_id === currentUserId && c.seller_id === otherUserId) ||
      (c.seller_id === currentUserId && c.buyer_id === otherUserId)
  );

  const messagesQuery = useQuery(
    (convexApi as any).messages.messages,
    conversation?.id ? { conversationId: conversation.id } : "skip"
  );

  const sendMessageMutation = useMutation((convexApi as any).messages.send);
  const upsertConversation = useMutation((convexApi as any).messages.upsert);
  const markReadMutation = useMutation((convexApi as any).messages.markRead);

  const messages: DirectMessage[] = (messagesQuery?.messages ?? []).map((m: any) => ({
    id: m.id,
    sender_id: m.sender_id,
    receiver_id: m.receiver_id,
    content: m.text ?? "",
    is_read: m.status === "read",
    created_at: m.created_at,
  }));

  // Send a message
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || !currentUserId || !otherUserId) return;

      setSending(true);
      try {
        let convId = conversation?.id;
        if (!convId) {
          const productId = (conversation as any)?.product_id;
          if (!productId) {
            throw new Error("Cannot start conversation without a product");
          }
          const result = await upsertConversation({ product_id: productId, buyer_id: currentUserId });
          convId = (result as any)?.conversation?._id || (result as any)?.conversation?.id;
        }

        await sendMessageMutation({
          conversation_id: convId,
          text: content.trim(),
        });
      } catch (error) {
        console.error("Error sending message:", error);
        throw error;
      } finally {
        setSending(false);
      }
    },
    [conversation, currentUserId, otherUserId, sendMessageMutation, upsertConversation]
  );

  // Mark message as read
  const markAsRead = useCallback(
    async (messageId: string) => {
      if (!conversation?.id) return;
      try {
        await markReadMutation({ conversation_id: conversation.id });
      } catch (error) {
        console.error("Error marking as read:", error);
      }
    },
    [conversation?.id, markReadMutation]
  );

  // Get unread count
  const unreadCount = messages.filter(
    (msg) => msg.sender_id === otherUserId && !msg.is_read
  ).length;

  const loadMessages = useCallback(async () => {
    // Messages load reactively via Convex queries
  }, []);

  return {
    messages,
    loading: messagesQuery === undefined && !!conversation,
    sending,
    sendMessage,
    markAsRead,
    unreadCount,
    loadMessages,
  };
}

/**
 * Hook for subscribing to all messages for the current user
 * Useful for showing notifications or unread badges
 */
export function useMessageNotifications(currentUserId: string | null) {
  const conversations = useQuery((convexApi as any).messages.conversations);
  const unreadCount =
    conversations?.conversations?.reduce(
      (total: number, conv: any) => total + (conv.unread_count || 0),
      0
    ) ?? 0;

  return { unreadCount };
}
