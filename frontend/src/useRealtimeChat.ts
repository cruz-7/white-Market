import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./supabase-client";

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
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Load existing messages
  const loadMessages = useCallback(async () => {
    if (!supabase || !currentUserId || !otherUserId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_id.eq.${currentUserId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUserId})`
        )
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error("Error loading messages:", error);
    } finally {
      setLoading(false);
    }
  }, [currentUserId, otherUserId]);

  // Setup realtime subscription
  useEffect(() => {
    if (!supabase || !currentUserId || !otherUserId) return;

    // Load initial messages
    loadMessages();

    // Create a unique channel name
    const channelName = `dm-${[currentUserId, otherUserId].sort().join("-")}`;

    // Remove previous channel if exists
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${currentUserId}`,
        },
        (payload) => {
          const newMessage = payload.new as DirectMessage;
          
          // Only add if it's from the other user
          if (newMessage.sender_id === otherUserId) {
            setMessages((prev) => {
              if (prev.some(m => m.id === newMessage.id)) return prev;
              return [...prev, newMessage];
            });
            
            // Mark as read
            markAsRead(newMessage.id);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (supabase && channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [currentUserId, otherUserId, loadMessages]);

  // Send a message
  const sendMessage = useCallback(
    async (content: string) => {
      if (!supabase || !content.trim() || !currentUserId || !otherUserId) return;

      setSending(true);
      try {
        const { data, error } = await supabase
          .from("messages")
          .insert({
            sender_id: currentUserId,
            receiver_id: otherUserId,
            content: content.trim(),
            is_read: false,
          })
          .select()
          .single();

        if (error) throw error;

        if (data) {
          setMessages((prev) => [...prev, data]);
        }
      } catch (error) {
        console.error("Error sending message:", error);
        throw error;
      } finally {
        setSending(false);
      }
    },
    [currentUserId, otherUserId]
  );

  // Mark message as read
  const markAsRead = useCallback(async (messageId: string) => {
    if (!supabase) return;

    try {
      await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("id", messageId);

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, is_read: true } : msg
        )
      );
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  }, []);

  // Get unread count
  const unreadCount = messages.filter(
    (msg) => msg.sender_id === otherUserId && !msg.is_read
  ).length;

  return {
    messages,
    loading,
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
  const [unreadCount, setUnreadCount] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!supabase || !currentUserId) return;

    // Count unread messages
    const countUnread = async () => {
      try {
        const { count, error } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("receiver_id", currentUserId)
          .eq("is_read", false);

        if (error) throw error;
        setUnreadCount(count || 0);
      } catch (error) {
        console.error("Error counting unread:", error);
      }
    };

    countUnread();

    // Subscribe to new messages
    const channel = supabase
      .channel("message-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${currentUserId}`,
        },
        () => {
          countUnread();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${currentUserId}`,
        },
        () => {
          countUnread();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (supabase && channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [currentUserId]);

  return { unreadCount };
}
