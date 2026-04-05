import { useState, useEffect, useRef } from "react";
import { Send, ThumbsUp, Heart, Laugh, Angry, X } from "lucide-react";

interface QuickRepliesProps {
  onSelect: (message: string) => void;
}

const quickReplies = [
  "I'm interested!",
  "Is this still available?",
  "What's the condition?",
  "Can we meet today?",
  "Is the price negotiable?"
];

export function QuickReplies({ onSelect }: QuickRepliesProps) {
  return (
    <div className="flex flex-wrap gap-2 p-2 border-t bg-muted/30">
      {quickReplies.map((reply, index) => (
        <button
          key={index}
          onClick={() => onSelect(reply)}
          className="text-xs px-3 py-1.5 rounded-full bg-white border hover:bg-primary hover:text-white hover:border-primary transition-colors"
        >
          {reply}
        </button>
      ))}
    </div>
  );
}

interface TypingIndicatorProps {
  isTyping: boolean;
  userName?: string;
}

export function TypingIndicator({ isTyping, userName }: TypingIndicatorProps) {
  if (!isTyping) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <div className="flex gap-1">
        <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span className="text-xs text-muted-foreground">
        {userName || 'Someone'} is typing...
      </span>
    </div>
  );
}

interface EmojiReactionsProps {
  messageId: string;
  onReact: (messageId: string, emoji: string) => void;
  show: boolean;
}

const reactions = [
  { emoji: "👍", icon: ThumbsUp },
  { emoji: "❤️", icon: Heart },
  { emoji: "😂", icon: Laugh },
  { emoji: "😠", icon: Angry },
];

export function EmojiReactions({ messageId, onReact, show }: EmojiReactionsProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!show) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-xs text-muted-foreground hover:text-foreground p-1"
      >
        😊
      </button>
      {isOpen && (
        <div className="absolute bottom-full left-0 mb-1 flex gap-1 bg-white rounded-full shadow-lg border p-1">
          {reactions.map((reaction, index) => (
            <button
              key={index}
              onClick={() => {
                onReact(messageId, reaction.emoji);
                setIsOpen(false);
              }}
              className="hover:scale-125 transition-transform p-1"
            >
              {reaction.emoji}
            </button>
          ))}
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 hover:bg-muted rounded-full"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

interface ReactionBarProps {
  reactions: Record<string, number>;
  onReact: (emoji: string) => void;
}

export function ReactionBar({ reactions, onReact }: ReactionBarProps) {
  const reactionEmojis = Object.entries(reactions).filter(([_, count]) => count > 0);
  
  return (
    <div className="flex items-center gap-2 mt-1">
      {reactionEmojis.map(([emoji, count]) => (
        <button
          key={emoji}
          onClick={() => onReact(emoji)}
          className="text-xs flex items-center gap-0.5 bg-muted/50 px-1.5 py-0.5 rounded-full hover:bg-muted"
        >
          <span>{emoji}</span>
          <span className="text-muted-foreground">{count}</span>
        </button>
      ))}
      <button
        onClick={() => onReact("👍")}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        +
      </button>
    </div>
  );
}

export function useTypingIndicator(conversationId: string | null, currentUserId: string | null) {
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const sendTypingIndicator = (typing: boolean) => {
    if (!conversationId || !currentUserId) return;
    
    // In a real implementation, this would broadcast to the other user via WebSocket
    // For now, we just track locally
    setIsTyping(typing);
  };

  const handleTextChange = (text: string) => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    sendTypingIndicator(true);
    
    typingTimeoutRef.current = setTimeout(() => {
      sendTypingIndicator(false);
    }, 2000);
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return {
    isTyping,
    typingUser,
    handleTextChange,
    sendTypingIndicator
  };
}

export default { QuickReplies, TypingIndicator, EmojiReactions, ReactionBar, useTypingIndicator };