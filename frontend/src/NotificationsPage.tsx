import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, Loader2, Check, CheckCheck, Trash2, MessageCircle, ShoppingBag, Wallet, Award } from "lucide-react";
import { toast } from "sonner";

import { Button } from "./button";
import { Card, CardContent } from "./card";
import { Badge } from "./badge";
import { notificationsApi, type Notification } from "./api";
import { timeAgo } from "./data";

const notificationIcons: Record<string, React.ReactNode> = {
  order_created: <ShoppingBag className="h-5 w-5 text-blue-500" />,
  order_paid: <ShoppingBag className="h-5 w-5 text-green-500" />,
  order_completed: <Award className="h-5 w-5 text-yellow-500" />,
  message_received: <MessageCircle className="h-5 w-5 text-purple-500" />,
  payout_sent: <Wallet className="h-5 w-5 text-green-500" />,
  verification_approved: <Award className="h-5 w-5 text-green-500" />,
  verification_rejected: <Bell className="h-5 w-5 text-red-500" />,
  referral_signup: <Award className="h-5 w-5 text-orange-500" />,
  review_received: <Award className="h-5 w-5 text-yellow-500" />,
};

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    const { data, error } = await notificationsApi.getAll();
    if (error) {
      toast.error(error);
    } else {
      setNotifications(data?.notifications || []);
      setUnreadCount(data?.unread_count || 0);
    }
    setLoading(false);
  };

  const handleMarkAsRead = async (id: string) => {
    setActionLoading(id);
    const { error } = await notificationsApi.markAsRead(id);
    if (error) {
      toast.error(error);
    } else {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
    setActionLoading(null);
  };

  const handleMarkAllAsRead = async () => {
    setActionLoading("all");
    const { error } = await notificationsApi.markAllAsRead();
    if (error) {
      toast.error(error);
    } else {
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
      toast.success("All notifications marked as read");
    }
    setActionLoading(null);
  };

  const handleDelete = async (id: string) => {
    setActionLoading(id);
    const { error } = await notificationsApi.delete(id);
    if (error) {
      toast.error(error);
    } else {
      const notification = notifications.find((n) => n.id === id);
      if (notification && !notification.is_read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }
    setActionLoading(null);
  };

  const getNotificationLink = (notification: Notification): string | null => {
    if (notification.type === "message_received" && notification.data?.conversation_id) {
      return `/messages/${notification.data.conversation_id}`;
    }
    if (notification.type?.startsWith("order") && notification.data?.order_id) {
      return `/orders/${notification.data.order_id}`;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 rounded-lg border border-transparent px-2 py-1 text-sm text-slate-500 transition hover:border-slate-200 hover:bg-white hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
      </div>

      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Bell className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold">Notifications</h1>
          {unreadCount > 0 && (
            <Badge variant="destructive">{unreadCount} unread</Badge>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            onClick={handleMarkAllAsRead}
            disabled={actionLoading === "all"}
          >
            {actionLoading === "all" ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CheckCheck className="h-4 w-4 mr-2" />
            )}
            Mark all as read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-12">
          <Bell className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <h2 className="text-xl font-semibold text-gray-600 mb-2">No notifications</h2>
          <p className="text-gray-500">
            You're all caught up! Check back later for updates.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.map((notification) => (
            <Card
              key={notification.id}
              className={`transition-colors ${
                !notification.is_read ? "border-l-4 border-l-primary bg-primary/5" : ""
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="mt-1">
                    {notificationIcons[notification.type] || (
                      <Bell className="h-5 w-5 text-gray-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{notification.title}</h3>
                      {!notification.is_read && (
                        <span className="w-2 h-2 bg-primary rounded-full" />
                      )}
                    </div>
                    {notification.body && (
                      <p className="text-sm text-gray-600 mt-1">{notification.body}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      {timeAgo(notification.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getNotificationLink(notification) && (
                      <Link to={getNotificationLink(notification)!}>
                        <Button variant="outline" size="sm">
                          View
                        </Button>
                      </Link>
                    )}
                    {!notification.is_read && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleMarkAsRead(notification.id)}
                        disabled={actionLoading === notification.id}
                      >
                        {actionLoading === notification.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(notification.id)}
                      disabled={actionLoading === notification.id}
                    >
                      {actionLoading === notification.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-red-500" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}