import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Users, Send, Loader2, ArrowLeft, Image } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "./supabase-client";
import { messagesApi } from "./api";
import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Input } from "./input";
import { ScrollArea } from "./scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { Badge } from "./badge";
import { Skeleton } from "./skeleton";

interface Conversation {
  id: string;
  product_title: string;
  product_image_url: string;
  buyer_name: string;
  seller_name: string;
  updated_at: string;
  last_message: any;
  unread_count: number;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  text?: string;
  image_url?: string;
  created_at: string;
  status: 'sent' | 'delivered' | 'read';
}

export default function MessagesPage() {
  const navigate = useNavigate();
