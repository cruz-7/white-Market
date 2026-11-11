import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MessageCircle, Send, Loader2, ArrowLeft, Check, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation } from "convex/react";
import { api as convexApi } from "../convex/_generated/api";
import { messagesApi, ChatMessage, Conversation } from "./api";
import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Input } from "./input";
import { ScrollArea } from "./scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { Badge } from "./badge";
import { Skeleton } from "./skeleton";
import { formatDistanceToNow } from "date-fns";
import { QuickReplies } from "./ChatEnhancements";

export default function MessagesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const conversationId = searchParams.get("conversation");
  const prefillMessage = searchParams.get("prefill");

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);
  const [showConversationList, setShowConversationList] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prefillAppliedRef = useRef<string | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const conversationsQuery = useQuery((convexApi as any).functions.messages.conversations);
  const conversations = conversationsQuery?.conversations ?? [];

  const messagesQuery = useQuery(
    (convexApi as any).functions.messages.messages,
    activeConversation?.id ? { conversationId: activeConversation.id } : "skip"
  );
  const messages = messagesQuery?.messages ?? [];

  const sendMessage = useMutation((convexApi as any).functions.messages.send);
  const markRead = useMutation((convexApi as any).functions.messages.markRead);

  const handleSendMessage = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = newMessage.trim();
    if (!text || !activeConversation?.id || sending || !currentUserId) return;

    setSending(true);
    try {
      await sendMessage({ conversation_id: activeConversation.id, text });
      setNewMessage("");
      setTimeout(scrollToBottom, 50);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Message could not be sent";
      console.error("[messages] Failed to send message:", error);
      toast.error(message);
    } finally {
      setSending(false);
    }
  }, [activeConversation?.id, activeConversation?.seller_id, activeConversation?.buyer_id, currentUserId, newMessage, scrollToBottom, sendMessage, sending]);

  // Check for mobile view
  useEffect(() => {
    const checkMobile = () => {
      setIsMobileView(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Get current user on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem("wm_user");
      if (raw) {
        const parsed = JSON.parse(raw);
        setCurrentUserId(parsed.id || null);
      }
    } catch {
      setCurrentUserId(null);
    }
  }, []);

  // Pick active conversation from URL or list
  useEffect(() => {
    if (!conversations.length) return;

    if (conversationId) {
      const conv = conversations.find((c: any) => c.id === conversationId);
      if (conv) {
        setActiveConversation(conv);
        setShowConversationList(false);
        return;
      }
    }

    if (!activeConversation && conversations.length > 0) {
      setActiveConversation(conversations[0]);
      if (isMobileView) {
        setShowConversationList(false);
      }
    }
  }, [conversationId, conversations, activeConversation, isMobileView]);

  useEffect(() => {
    if (!conversationId || activeConversation?.id !== conversationId || !prefillMessage) return;
    const prefillKey = `${conversationId}:${prefillMessage}`;
    if (prefillAppliedRef.current === prefillKey) return;
    prefillAppliedRef.current = prefillKey;
    setNewMessage((current) => current || prefillMessage);
  }, [activeConversation?.id, conversationId, prefillMessage]);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  useEffect(() => {
    if (!activeConversation?.id || !currentUserId) return;
    const unread = messages.some(
      (m: ChatMessage) => m.sender_id !== currentUserId && m.status !== "read"
    );
    if (unread) {
      markRead({ conversation_id: activeConversation.id }).catch(() => {});
    }
  }, [activeConversation?.id, currentUserId, messages, markRead]);

  const selectConversation = (conv: Conversation) => {
    setActiveConversation(conv);
    setShowConversationList(false);
    navigate(`/messages?conversation=${conv.id}`, { replace: true });
  };

  const goBack = () => {
    setShowConversationList(true);
    setActiveConversation(null);
    navigate("/messages", { replace: true });
  };

  const getOtherUserName = (conv: Conversation) => {
    return conv.buyer_id === currentUserId ? conv.seller_name : conv.buyer_name;
  };

  const formatMessageTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return "";
    }
  };

  const renderMessageStatus = (status: string) => {
    switch (status) {
      case "read":
        return <CheckCheck className="w-3 h-3 text-blue-500" />;
      case "delivered":
        return <CheckCheck className="w-3 h-3 text-gray-400" />;
      case "sent":
        return <Check className="w-3 h-3 text-gray-400" />;
      default:
        return null;
    }
  };

  if (conversationsQuery === undefined) {
    return (
      <div className="container mx-auto p-4 max-w-4xl">
        <div className="flex items-center justify-center h-[70vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-2 md:p-4 max-w-4xl">
      <Card className="h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <CardHeader className="pb-2 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {(activeConversation && !showConversationList) && (
                <Button variant="ghost" size="icon" onClick={goBack} className="md:hidden">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              )}
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageCircle className="w-5 h-5" />
                {activeConversation ? getOtherUserName(activeConversation) : "Messages"}
              </CardTitle>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 p-0 overflow-hidden">
          <div className="flex h-full">
            {/* Conversation List */}
            {(showConversationList || !isMobileView) && (
              <div 
                className={`${isMobileView && activeConversation ? 'hidden md:block' : ''} 
                  w-full md:w-80 border-r overflow-hidden flex flex-col`}
              >
                <ScrollArea className="h-full">
                  {conversations.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">
                      <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No conversations yet</p>
                      <p className="text-sm">Start a conversation by contacting a seller</p>
                    </div>
                  ) : (
                    conversations.map((conv: any) => (
                      <div
                        key={conv.id}
                        onClick={() => selectConversation(conv)}
                        className={`p-3 border-b cursor-pointer hover:bg-muted/50 transition-colors 
                          ${activeConversation?.id === conv.id ? 'bg-muted' : ''}`}
                      >
                        <div className="flex items-start gap-3">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={conv.product_image_url} />
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {getOtherUserName(conv).charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="font-medium truncate">
                                {getOtherUserName(conv)}
                              </p>
                              <span className="text-xs text-muted-foreground">
                                {conv.updated_at ? formatMessageTime(conv.updated_at) : ""}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {conv.product_title}
                            </p>
                            {conv.last_message && (
                              <div className="flex items-center justify-between mt-1">
                                <p className="text-xs text-muted-foreground truncate flex-1">
                                  {conv.last_message.text || "Image"}
                                </p>
                                {conv.unread_count > 0 && (
                                  <Badge variant="default" className="ml-2 h-5 min-w-5 px-1.5">
                                    {conv.unread_count}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </ScrollArea>
              </div>
            )}

            {/* Chat Area */}
            {(!showConversationList || !isMobileView) && (
              <div className="flex-1 flex flex-col">
                {activeConversation ? (
                  <>
                    {/* Product Info Bar */}
                    <div className="p-2 border-b bg-muted/30 flex items-center gap-2 flex-shrink-0">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={activeConversation.product_image_url} />
                        <AvatarFallback className="text-xs">P</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{activeConversation.product_title}</p>
                      </div>
                    </div>

                    {/* Messages */}
                    <ScrollArea className="flex-1 p-4">
                      {messagesQuery === undefined && activeConversation ? (
                        <div className="flex items-center justify-center h-full">
                          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : messages.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          <p>No messages yet. Start the conversation!</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {messages.map((msg: ChatMessage, index: number) => {
                            const isMe = msg.sender_id === currentUserId;
                            const showAvatar = !isMe && (index === 0 || messages[index - 1].sender_id !== msg.sender_id);

                            return (
                              <div
                                key={msg.id}
                                className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                              >
                                <div className={`flex ${isMe ? 'flex-row-reverse' : 'flex-row'} items-end gap-2 max-w-[75%]`}>
                                  {showAvatar && !isMe && (
                                    <Avatar className="w-8 h-8">
                                      <AvatarFallback className="text-xs bg-primary/10">
                                        {getOtherUserName(activeConversation).charAt(0).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                  )}
                                  {!showAvatar && !isMe && <div className="w-8" />}
                                  
                                  <div>
                                    <div
                                      className={`px-3 py-2 rounded-2xl ${
                                        isMe
                                          ? 'bg-primary text-primary-foreground rounded-br-md'
                                          : 'bg-muted rounded-bl-md'
                                      }`}
                                    >
                                      {msg.image_url ? (
                                        <img 
                                          src={msg.image_url} 
                                          alt="Shared image" 
                                          className="max-w-[200px] rounded-lg"
                                        />
                                      ) : (
                                        <p className="text-sm">{msg.text}</p>
                                      )}
                                    </div>
                                    <div className={`flex items-center gap-1 mt-1 ${isMe ? 'justify-end' : ''}`}>
                                      <span className="text-[10px] text-muted-foreground">
                                        {formatMessageTime(msg.created_at)}
                                      </span>
                                      {isMe && renderMessageStatus(msg.status)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          <div ref={messagesEndRef} />
                        </div>
                      )}
                    </ScrollArea>

                    {/* Quick Replies */}
                    {activeConversation && (
                      <QuickReplies 
                        onSelect={(message) => {
                          setNewMessage(message);
                          // Focus the input and let user send
                          const input = document.querySelector('input[placeholder="Type a message..."]') as HTMLInputElement;
                          input?.focus();
                        }} 
                      />
                    )}

                    {/* Message Input */}
                    <form onSubmit={handleSendMessage} className="p-3 border-t flex items-center gap-2 flex-shrink-0">
                      <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1"
                        disabled={sending}
                      />
                      <Button type="submit" size="icon" disabled={!newMessage.trim() || sending}>
                        {sending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </Button>
                    </form>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-30" />
                      <p className="text-lg font-medium">Select a conversation</p>
                      <p className="text-sm">Choose a conversation from the list to start chatting</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
