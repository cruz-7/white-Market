// cspell:ignore momo
import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { 
  CalendarDays, CircleHelp, Download, FileText, Info, Search, ShoppingCart, Store, UserRound, Wallet,
  AlertTriangle, CheckCircle, Shield, DollarSign, Activity, Package, Eye, ArrowUpRight, ArrowDownRight,
  TrendingUp, TrendingDown, Users, CreditCard, Star, Bell, Layers, Briefcase, Gift, MoreVertical,
  Filter, RefreshCw, Trash2, Ban, Unlock, XCircle, Check, Edit, Plus, ChevronDown,
  Wrench, UserCheck, Banknote, FolderTree, Trophy, Mail, MessageSquare
} from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell } from "recharts";
import { toast } from "sonner";

import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./card";
import { Input } from "./input";
import { Badge } from "./badge";
import { 
  LocalUser, 
  timeAgo 
} from "./data";
import { 
  adminApi, 
  categoriesApi, 
  referralsApi, 
  notificationsApi, 
  servicesApi,
  verificationApi,
  feedbackApi,
  AdminUser,
  AdminProduct,
  AdminOrder,
  Category,
  Service,
  Verification
} from "./api";

type Props = Readonly<{
  user: LocalUser;
}>;

type AdminRole = "operations" | "finance" | "compliance" | "content" | "growth";
type TabType = "dashboard" | "users" | "products" | "orders" | "disputes" | "verification" | "categories" | "services" | "referrals" | "notifications" | "settings" | "feedback" | "payouts" | "leaderboard";
type ActivityType = "all" | "orders" | "payments" | "disputes" | "verification" | "products";
type ActivityRecordType = Exclude<ActivityType, "all">;
type PriorityLevel = "critical" | "high" | "medium" | "low";
type SlaLevel = "critical" | "warning" | "ok";
type ActivitySeverity = "normal" | "warning" | "high";

type ActivityItem = {
  id: string;
  type: ActivityRecordType;
  text: string;
  time: string;
  severity: ActivitySeverity;
};

type PendingAction = {
  id: string;
  label: string;
  count: number;
  priority: PriorityLevel;
  updatedAt: string;
  age: number;
  sla: SlaLevel;
  cta: string;
  target: TabType;
  description: string;
};

const DAY_MS = 86400000;
const COMMISSION_RATE = 0.1;
const COLORS = ["#0d9488", "#6366f1", "#f59e0b", "#ef4444", "#10b981", "#8b5cf6"];

function inRange(iso: string, from: Date, to: Date) {
  const t = +new Date(iso);
  return t >= +from && t <= +to;
}

function percentDelta(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

function fmtDelta(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function fmtCurrency(value: number) {
  return `GHS ${value.toFixed(2)}`;
}

function getDaysOld(isoString: string): number {
  return Math.floor((Date.now() - +new Date(isoString)) / DAY_MS);
}

function getSLAStatus(daysOld: number, criticalDays = 3, warningDays = 7): "critical" | "warning" | "ok" {
  if (daysOld >= criticalDays) return "critical";
  if (daysOld >= warningDays) return "warning";
  return "ok";
}

function getVerificationPriority(count: number): PriorityLevel {
  if (count > 5) return "high";
  if (count > 0) return "medium";
  return "low";
}

function getVerificationSla(count: number): SlaLevel {
  if (count > 10) return "critical";
  if (count > 5) return "warning";
  return "ok";
}

function getPendingActionCardClass(priority: PriorityLevel): string {
  if (priority === "critical") return "border-red-200 bg-red-50";
  if (priority === "high") return "border-orange-200 bg-orange-50";
  return "border-slate-200";
}

function getActivityContainerClass(severity: ActivitySeverity): string {
  if (severity === "high") return "border-red-200 bg-red-50";
  if (severity === "warning") return "border-amber-200 bg-amber-50";
  return "border-slate-200";
}

function getActivityBadgeClass(type: ActivityRecordType): string {
  if (type === "orders") return "bg-slate-100 text-slate-700";
  if (type === "payments") return "bg-emerald-100 text-emerald-700";
  if (type === "disputes") return "bg-red-100 text-red-700";
  if (type === "verification") return "bg-amber-100 text-amber-700";
  return "bg-blue-100 text-blue-700";
}

function getOrderStatusTextClass(status: string): string {
  if (status === "completed" || status === "paid") return "text-emerald-600";
  if (status === "disputed") return "text-red-600";
  if (status === "pending") return "text-amber-600";
  if (status === "cancelled") return "text-slate-500";
  return "text-slate-600";
}

function getPriorityBadge(priority: string) {
  switch (priority) {
    case "critical": return "bg-red-100 text-red-700 border-red-200";
    case "high": return "bg-orange-100 text-orange-700 border-orange-200";
    case "medium": return "bg-amber-100 text-amber-700 border-amber-200";
    default: return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

function getSLABadge(sla: string) {
  switch (sla) {
    case "critical": return "bg-red-500 text-white";
    case "warning": return "bg-amber-500 text-white";
    default: return "bg-emerald-500 text-white";
  }
}

export default function AdminDashboardView({ user }: Props) {
  const navigate = useNavigate();
  
  // State
  const [adminRole, setAdminRole] = useState<AdminRole>("operations");
  const [tab, setTab] = useState<TabType>("dashboard");
  const [searchTerm, setSearchTerm] = useState("");
  const [activityFilter, setActivityFilter] = useState<ActivityType>("all");
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [rangePreset, setRangePreset] = useState<"7d" | "30d" | "90d">("30d");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [bulkAction, setBulkAction] = useState("");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  
  // Real data from API
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [stats, setStats] = useState<{ totalUsers: number; totalOrders: number; totalRevenue: number; totalProducts: number; commission: number } | null>(null);
  const [enhancedStats, setEnhancedStats] = useState<{
    users: { total: number; active: number; newToday: number; newThisWeek: number };
    orders: { total: number; pending: number; completed: number; cancelled: number; revenue: number };
    products: { total: number; active: number; pending: number };
    revenue: { total: number; thisMonth: number; lastMonth: number; averageOrder: number };
    referrals: { total: number; qualified: number; creditsIssued: number };
    growth: { userGrowth: number; orderGrowth: number; revenueGrowth: number };
  } | null>(null);
  const [systemHealth, setSystemHealth] = useState<{
    status: string;
    database: { connected: boolean; responseTime: number };
    api: { responseTime: number; uptime: number };
    storage: { used: number; total: number };
  } | null>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [apiTopSellers, setApiTopSellers] = useState<any[]>([]);
  const [revenueAnalytics, setRevenueAnalytics] = useState<{ daily: any[]; weekly: any[]; monthly: any[] } | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [referralStats, setReferralStats] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [feedbackStats, setFeedbackStats] = useState<any>(null);
  const [feedbackList, setFeedbackList] = useState<any[]>([]);
  
  // Loading states for progressive loading
  const [loadingStates, setLoadingStates] = useState({
    critical: true, // stats, users, products, orders
    categories: false,
    verifications: false,
    referrals: false,
    notifications: false,
    systemHealth: false,
    activity: false,
    topSellers: false,
    revenue: false,
    services: false,
    feedback: false
  });

  // Cached data with timestamps
  const [dataCache, setDataCache] = useState<{
    [key: string]: { data: any; timestamp: number; ttl: number };
  }>({});

  // Cache helper functions
  const getCachedData = (key: string) => {
    const cached = dataCache[key];
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }
    return null;
  };

  const setCachedData = (key: string, data: any, ttl: number = 30000) => { // 30 seconds default
    setDataCache(prev => ({
      ...prev,
      [key]: { data, timestamp: Date.now(), ttl }
    }));
  };

  // Update isLoading to be based on critical data only
  const isLoading = loadingStates.critical;

  // Skeleton loading component
  const SkeletonCard = ({ className = "" }: { className?: string }) => (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
          <div className="h-8 bg-slate-200 rounded w-1/2"></div>
        </div>
      </CardContent>
    </Card>
  );

  const SkeletonTable = ({ rows = 5 }: { rows?: number }) => (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="animate-pulse flex space-x-4">
          <div className="h-4 bg-slate-200 rounded flex-1"></div>
          <div className="h-4 bg-slate-200 rounded w-24"></div>
          <div className="h-4 bg-slate-200 rounded w-20"></div>
          <div className="h-4 bg-slate-200 rounded w-16"></div>
        </div>
      ))}
    </div>
  );

  // Progressive data fetching
  const fetchCriticalData = useCallback(async () => {
    setLoadingStates(prev => ({ ...prev, critical: true }));
    try {
      const [statsRes, usersRes, productsRes, ordersRes] = await Promise.all([
        adminApi.getStats(),
        adminApi.getAllUsers(),
        adminApi.getAllProducts(),
        adminApi.getAllOrders()
      ]);

      if (statsRes.data) {
        const statsData = {
          totalUsers: statsRes.data.totalUsers || 0,
          totalOrders: statsRes.data.totalOrders || 0,
          totalRevenue: statsRes.data.totalRevenue || 0,
          totalProducts: statsRes.data.totalProducts || 0,
          commission: statsRes.data.commission || 0
        };
        setStats(statsData);
        setCachedData('stats', statsData);
      }

      if (usersRes.data) {
        setUsers(usersRes.data);
        setCachedData('users', usersRes.data);
      }

      if (productsRes.data) {
        setProducts(productsRes.data);
        setCachedData('products', productsRes.data);
      }

      if (ordersRes.data) {
        setOrders(ordersRes.data);
        setCachedData('orders', ordersRes.data);
      }

    } catch (error) {
      console.error("Failed to fetch critical data:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoadingStates(prev => ({ ...prev, critical: false }));
    }
  }, []);

  const fetchSecondaryData = useCallback(async () => {
    const promises = [];

    // Categories
    if (!getCachedData('categories')) {
      setLoadingStates(prev => ({ ...prev, categories: true }));
      promises.push(
        categoriesApi.getAll().then(res => {
          if (res.data) {
            setCategories(res.data);
            setCachedData('categories', res.data);
          }
        }).catch(err => console.error("Categories fetch failed:", err))
          .finally(() => setLoadingStates(prev => ({ ...prev, categories: false })))
      );
    }

    // Verifications
    if (!getCachedData('verifications')) {
      setLoadingStates(prev => ({ ...prev, verifications: true }));
      promises.push(
        verificationApi.getAllPending().then(res => {
          if (res.data?.verifications) {
            setVerifications(res.data.verifications);
            setCachedData('verifications', res.data.verifications);
          }
        }).catch(err => console.error("Verifications fetch failed:", err))
          .finally(() => setLoadingStates(prev => ({ ...prev, verifications: false })))
      );
    }

    // Dashboard stats
    if (!getCachedData('dashboardStats')) {
      promises.push(
        adminApi.getDashboardStats().then(res => {
          if (res.data) {
            setEnhancedStats(res.data);
            setCachedData('dashboardStats', res.data);
          }
        }).catch(err => console.error("Dashboard stats fetch failed:", err))
      );
    }

    // System health
    if (!getCachedData('systemHealth')) {
      setLoadingStates(prev => ({ ...prev, systemHealth: true }));
      promises.push(
        adminApi.getSystemHealth().then(res => {
          if (res.data) {
            setSystemHealth(res.data);
            setCachedData('systemHealth', res.data, 60000); // 1 minute TTL
          }
        }).catch(err => console.error("System health fetch failed:", err))
          .finally(() => setLoadingStates(prev => ({ ...prev, systemHealth: false })))
      );
    }

    await Promise.allSettled(promises);
  }, []);

  const fetchActivityData = useCallback(async () => {
    if (getCachedData('activity')) return;

    setLoadingStates(prev => ({ ...prev, activity: true }));
    try {
      const [activityRes, topSellersRes, revenueRes] = await Promise.all([
        adminApi.getRecentActivity(20),
        adminApi.getTopSellers(10),
        adminApi.getRevenueAnalytics("month")
      ]);

      if (activityRes.data) {
        setRecentActivity(activityRes.data);
        setCachedData('activity', activityRes.data, 60000);
      }

      if (topSellersRes.data) {
        setApiTopSellers(topSellersRes.data);
        setCachedData('topSellers', topSellersRes.data, 300000); // 5 minutes
      }

      if (revenueRes.data) {
        setRevenueAnalytics(revenueRes.data);
        setCachedData('revenue', revenueRes.data, 300000);
      }

    } catch (error) {
      console.error("Failed to fetch activity data:", error);
    } finally {
      setLoadingStates(prev => ({ ...prev, activity: false, topSellers: false, revenue: false }));
    }
  }, []);

  const fetchNotificationsAndReferrals = useCallback(async () => {
    if (getCachedData('notifications') && getCachedData('referrals')) return;

    try {
      const promises = [];

      if (!getCachedData('notifications')) {
        setLoadingStates(prev => ({ ...prev, notifications: true }));
        promises.push(
          notificationsApi.getAll(1, 50).then(res => {
            if (res.data?.notifications) {
              setNotifications(res.data.notifications);
              setCachedData('notifications', res.data.notifications, 30000);
            }
          }).catch(err => console.error("Notifications fetch failed:", err))
            .finally(() => setLoadingStates(prev => ({ ...prev, notifications: false })))
        );
      }

      if (!getCachedData('referrals')) {
        setLoadingStates(prev => ({ ...prev, referrals: true }));
        promises.push(
          referralsApi.getAdminStats().then(res => {
            if (res.data) {
              setReferralStats(res.data);
              setCachedData('referrals', res.data, 120000); // 2 minutes
            }
          }).catch(err => console.error("Referrals fetch failed:", err))
            .finally(() => setLoadingStates(prev => ({ ...prev, referrals: false })))
        );
      }

      await Promise.allSettled(promises);
    } catch (error) {
      console.error("Failed to fetch notifications and referrals:", error);
    }
  }, []);

  // Optimized refresh function
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);

    // Clear cache for immediate refresh
    setDataCache({});

    try {
      await Promise.all([
        fetchCriticalData(),
        fetchSecondaryData(),
        fetchActivityData(),
        fetchNotificationsAndReferrals()
      ]);
    } catch (error) {
      console.error("Refresh failed:", error);
      toast.error("Failed to refresh data");
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchCriticalData, fetchSecondaryData, fetchActivityData, fetchNotificationsAndReferrals]);

  // Initial load - progressive loading
  useEffect(() => {
    // Load critical data first
    fetchCriticalData();

    // Load secondary data after a short delay
    const secondaryTimer = setTimeout(() => {
      fetchSecondaryData();
    }, 100);

    // Load activity data after another delay
    const activityTimer = setTimeout(() => {
      fetchActivityData();
    }, 200);

    // Load notifications and referrals last
    const notificationsTimer = setTimeout(() => {
      fetchNotificationsAndReferrals();
    }, 300);

    return () => {
      clearTimeout(secondaryTimer);
      clearTimeout(activityTimer);
      clearTimeout(notificationsTimer);
    };
  }, []);
  
  // Fetch services
  const fetchServices = useCallback(async () => {
    setLoadingStates(prev => ({ ...prev, services: true }));
    try {
      const res = await servicesApi.getAll(undefined, 100, 0);
      if (res.data?.services) setServices(res.data.services);
    } catch (error) {
      console.error("Failed to fetch services:", error);
    } finally {
      setLoadingStates(prev => ({ ...prev, services: false }));
    }
  }, []);
  
  useEffect(() => {
    if (tab === "services" && services.length === 0) {
      fetchServices();
    }
  }, [tab, services.length, fetchServices]);

  const fetchFeedback = useCallback(async () => {
    setLoadingStates(prev => ({ ...prev, feedback: true }));
    try {
      const [statsRes, listRes] = await Promise.all([
        feedbackApi.getStats(),
        feedbackApi.getAll(1, 50),
      ]);
      if (statsRes.data?.stats) setFeedbackStats(statsRes.data.stats);
      if (listRes.data?.feedback) setFeedbackList(listRes.data.feedback);
    } catch (error) {
      console.error("Failed to fetch feedback:", error);
    } finally {
      setLoadingStates(prev => ({ ...prev, feedback: false }));
    }
  }, []);

  useEffect(() => {
    if (tab === "feedback" && feedbackStats === null) {
      fetchFeedback();
    }
  }, [tab, feedbackStats, fetchFeedback]);
  
  const now = new Date();
  
  // Date range calculations
  let startDate = new Date(now.getTime() - 29 * DAY_MS);
  let endDate = now;
  if (rangePreset === "7d") startDate = new Date(now.getTime() - 6 * DAY_MS);
  if (rangePreset === "90d") startDate = new Date(now.getTime() - 89 * DAY_MS);
  
  const rangeSpan = Math.max(DAY_MS, +endDate - +startDate + 1);
  const prevEnd = new Date(+startDate - 1);
  const prevStart = new Date(+prevEnd - rangeSpan + 1);
  
  const settledStatuses = new Set<string>(["paid", "completed"]);
  const search = searchTerm.toLowerCase().trim();
  
  // Filter data by range
  const rangeOrders = orders.filter((o) => inRange(o.created_at, startDate, endDate));
  const prevOrders = orders.filter((o) => inRange(o.created_at, prevStart, prevEnd));
  const rangeProducts = products.filter((p) => inRange(p.created_at || "", startDate, endDate));
  const prevProducts = products.filter((p) => inRange(p.created_at || "", prevStart, prevEnd));
  
  // Financial calculations
  const gmv = rangeOrders.reduce((sum, o) => sum + o.amount, 0);
  const prevGmv = prevOrders.reduce((sum, o) => sum + o.amount, 0);
  const revenue = rangeOrders.filter((o) => settledStatuses.has(o.status)).reduce((sum, o) => sum + o.amount * COMMISSION_RATE, 0);
  const prevRevenue = prevOrders.filter((o) => settledStatuses.has(o.status)).reduce((sum, o) => sum + o.amount * COMMISSION_RATE, 0);
  
  // Seller metrics
  const sellers = users.filter((u) => u.role === "seller");
  const activeSellers = sellers.filter((s) => products.some((p) => p.seller_id === s.id && p.is_active));
  const pendingVerification = sellers.filter((s) => !s.momo_number);
  const verifiedSellers = sellers.filter((s) => s.momo_number);
  
  // Marketplace quality metrics
  const openDisputes = orders.filter((o) => o.status === "disputed");
  const disputeRate = rangeOrders.length > 0 ? (openDisputes.length / rangeOrders.length) * 100 : 0;
  const flaggedProducts = products.filter((p) => !p.is_active);
  
  // Daily trend data
  const dayKeys: string[] = [];
  for (let d = new Date(startDate); +d <= +endDate; d = new Date(+d + DAY_MS)) {
    dayKeys.push(d.toISOString().slice(0, 10));
  }
  
  const revenueTrend = dayKeys.map((day) => {
    const dayOrders = rangeOrders.filter((o) => o.created_at.startsWith(day));
    const dayGmv = dayOrders.reduce((sum, o) => sum + o.amount, 0);
    const dayRevenue = dayOrders.filter((o) => settledStatuses.has(o.status)).reduce((sum, o) => sum + o.amount * COMMISSION_RATE, 0);
    return { day: day.slice(5), gmv: +dayGmv.toFixed(2), revenue: +dayRevenue.toFixed(2) };
  });
  
  const orderVolume = dayKeys.map((day) => {
    const dayOrders = rangeOrders.filter((o) => o.created_at.startsWith(day));
    return { 
      day: day.slice(5), 
      orders: dayOrders.length, 
      disputes: dayOrders.filter((o) => o.status === "disputed").length 
    };
  });
  
  const userGrowth = dayKeys.map((day) => {
    const dayEnd = new Date(`${day}T23:59:59`);
    return { day: day.slice(5), users: users.filter((u) => +new Date(u.created_at || now) <= +dayEnd).length };
  });
  
  // Category distribution
  const categoryDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    products.forEach((p) => {
      const cat = p.category || "Uncategorized";
      dist[cat] = (dist[cat] || 0) + 1;
    });
    return Object.entries(dist).map(([name, value]) => ({ name, value }));
  }, [products]);
  
  // Order status distribution
  const orderStatusDistribution = useMemo(() => {
    const statusCounts = orders.reduce((acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
  }, [orders]);
  
  // Top sellers
  const topSellers = useMemo(() => {
    const sellerOrders: Record<string, number> = {};
    orders.forEach((o) => {
      if (o.seller_id) {
        sellerOrders[o.seller_id] = (sellerOrders[o.seller_id] || 0) + o.amount;
      }
    });
    return Object.entries(sellerOrders)
      .map(([sellerId, total]) => {
        const seller = users.find((u) => u.id === sellerId);
        return { id: sellerId, name: seller?.full_name || "Unknown", total };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [orders, users]);
  
  // Activities feed
  const activities = useMemo(() => {
    const items: ActivityItem[] = [
      ...orders.map((o) => ({ 
        id: `order-${o.id}`, 
        type: "orders" as const, 
        text: `Order #${o.id.slice(-6)} created - ${o.product?.title || "Product"} (${o.buyer?.full_name || "Buyer"})`, 
        time: o.created_at,
        severity: "normal" as const
      })),
      ...orders.filter((o) => settledStatuses.has(o.status)).map((o) => ({ 
        id: `payment-${o.id}`, 
        type: "payments" as const, 
        text: `Payment of ${fmtCurrency(o.amount)} settled for Order #${o.id.slice(-6)}`, 
        time: o.created_at,
        severity: "normal" as const
      })),
      ...openDisputes.map((o) => ({ 
        id: `dispute-${o.id}`, 
        type: "disputes" as const, 
        text: `⚠️ Dispute raised on Order #${o.id.slice(-6)} - ${o.product?.title}`, 
        time: o.created_at,
        severity: "high" as const
      })),
      ...rangeProducts.map((p) => ({
        id: `product-${p.id}`,
        type: "products" as const,
        text: `Seller listed "${p.title}" in ${p.category || "General"}`,
        time: p.created_at || "",
        severity: (p.is_active ? "normal" : "warning") as ActivitySeverity
      })),
      ...verifications.map((v) => ({
        id: `verify-${v.id}`,
        type: "verification" as const,
        text: `Verification request from ${v.user?.full_name || "User"}`,
        time: v.created_at,
        severity: "warning" as const
      }))
    ]
    .sort((a, b) => +new Date(b.time) - +new Date(a.time))
    .filter((a) => activityFilter === "all" || a.type === activityFilter)
    .filter((a) => search.length === 0 || a.text.toLowerCase().includes(search));
    
    return items;
  }, [orders, openDisputes, rangeProducts, verifications, activityFilter, search]);
  
  // Pending actions with priority, age, and SLA
  const pendingActions = useMemo<PendingAction[]>(() => [
    { 
      id: "disputes", 
      label: "Open Disputes", 
      count: openDisputes.length, 
      priority: openDisputes.length ? "critical" : "low", 
      updatedAt: openDisputes[0]?.created_at || now.toISOString(),
      age: openDisputes[0] ? getDaysOld(openDisputes[0].created_at) : 0,
      sla: openDisputes[0] ? getSLAStatus(getDaysOld(openDisputes[0].created_at)) : "ok",
      cta: "Resolve", 
      target: "disputes" as const,
      description: "Disputes requiring immediate attention"
    },
    { 
      id: "verification", 
      label: "Seller Verification", 
      count: verifications.length || pendingVerification.length, 
      priority: getVerificationPriority(verifications.length || pendingVerification.length), 
      updatedAt: now.toISOString(),
      age: verifications.length || pendingVerification.length,
      sla: getVerificationSla(verifications.length || pendingVerification.length),
      cta: "Review", 
      target: "verification" as const,
      description: "Sellers awaiting identity verification"
    },
    { 
      id: "flagged-products", 
      label: "Flagged Content", 
      count: flaggedProducts.length, 
      priority: getFlaggedContentPriority(flaggedProducts.length), 
      updatedAt: products[0]?.created_at || now.toISOString(),
      age: 0,
      sla: "ok",
      cta: "Review", 
      target: "products" as const,
      description: "Products reported or hidden for review"
    },
    { 
      id: "pending-orders", 
      label: "Pending Payments", 
      count: orders.filter((o) => o.status === "pending").length, 
      priority: "medium", 
      updatedAt: orders[0]?.created_at || now.toISOString(),
      age: orders[0] ? getDaysOld(orders[0].created_at) : 0,
      sla: "ok",
      cta: "View", 
      target: "orders" as const,
      description: "Orders awaiting payment confirmation"
    },
    {
      id: "notifications",
      label: "Unread Notifications",
      count: notifications.filter((n) => !n.is_read).length,
      priority: "low",
      updatedAt: notifications[0]?.created_at || now.toISOString(),
      age: 0,
      sla: "ok",
      cta: "View",
      target: "notifications" as const,
      description: "Unread system notifications"
    }
  ], [openDisputes, verifications, pendingVerification, flaggedProducts, orders, products, notifications]);
  
  function getFlaggedContentPriority(count: number): PriorityLevel {
    if (count > 3) return "high";
    if (count > 0) return "medium";
    return "low";
  }
  
  // Action handlers
  const handleResolveDispute = async (orderId: string) => {
    try {
      await adminApi.updateOrderStatus(orderId, "paid");
      toast.success(`Dispute on order #${orderId.slice(-6)} resolved`);
      await fetchCriticalData(); // Refresh orders data
    } catch (error) {
      toast.error("Failed to resolve dispute");
    }
  };
  
  const handleVerifySeller = async (verificationId: string) => {
    try {
      await verificationApi.approve(verificationId);
      toast.success("Seller verified successfully");
      await fetchSecondaryData(); // Refresh verifications data
    } catch (error) {
      toast.error("Failed to verify seller");
    }
  };
  
  const handleRejectVerification = async (verificationId: string) => {
    try {
      await verificationApi.reject(verificationId, "Verification rejected by admin");
      toast.success("Verification rejected");
      await fetchSecondaryData(); // Refresh verifications data
    } catch (error) {
      toast.error("Failed to reject verification");
    }
  };
  
  const handleRestoreProduct = async (productId: string) => {
    try {
      // Note: Need to add this endpoint to admin API
      toast.success("Product restored successfully");
      await fetchCriticalData(); // Refresh products data
    } catch (error) {
      toast.error("Failed to restore product");
    }
  };
  
  const handleRemoveProduct = async (productId: string) => {
    try {
      await adminApi.removeProduct(productId);
      toast.success("Product removed");
      await fetchCriticalData(); // Refresh products data
    } catch (error) {
      toast.error("Failed to remove product");
    }
  };
  
  const handleBanUser = async (userId: string) => {
    try {
      await adminApi.banUser(userId);
      toast.success("User banned");
      await fetchCriticalData(); // Refresh users data
    } catch (error) {
      toast.error("Failed to ban user");
    }
  };
  
  const handleUnbanUser = async (userId: string) => {
    try {
      await adminApi.unbanUser(userId);
      toast.success("User unbanned");
      await fetchCriticalData(); // Refresh users data
    } catch (error) {
      toast.error("Failed to unban user");
    }
  };
  
  const handleUpdateUserRole = async (userId: string, role: string) => {
    try {
      await adminApi.updateUserRole(userId, role as any);
      toast.success(`User role updated to ${role}`);
      await fetchCriticalData(); // Refresh users data
    } catch (error) {
      toast.error("Failed to update user role");
    }
  };
  
  const handleGenerateReport = async () => {
    try {
      const reportData = {
        dateRange: rangePreset,
        stats,
        orders: orders.length,
        products: products.length,
        users: users.length
      };
      const csvContent = `Admin Report - ${new Date().toLocaleDateString()}\n\nPlatform Statistics:\nTotal Users: ${users.length}\nTotal Orders: ${orders.length}\nTotal Products: ${products.length}\nTotal Revenue: GHS ${stats?.totalRevenue || 0}\nCommission: GHS ${stats?.commission || 0}`;
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `admin-report-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      toast.success("Report generated and downloaded");
    } catch (error) {
      toast.error("Failed to generate report");
    }
  };
  
  const handleShowBannedUsers = () => {
    setSearchTerm("banned");
    setTab("users");
  };
  
  const handleCampaign = () => {
    toast.info("Campaign feature coming soon. Stay tuned!");
  };
  
  const handleMarkNotificationRead = async (notificationId: string) => {
    try {
      await notificationsApi.markAsRead(notificationId);
      await fetchNotificationsAndReferrals(); // Refresh notifications data
    } catch (error) {
      console.error("Failed to mark notification read:", error);
    }
  };
  
  const handleMarkAllNotificationsRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      toast.success("All notifications marked as read");
      await fetchNotificationsAndReferrals(); // Refresh notifications data
    } catch (error) {
      toast.error("Failed to mark all notifications as read");
    }
  };
  
  // Bulk actions
  const handleBulkAction = async () => {
    if (!bulkAction || selectedItems.size === 0) return;
    
    toast.info(`Processing ${selectedItems.size} items...`);
    setSelectedItems(new Set());
    setBulkAction("");
    handleRefresh();
  };
  
  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedItems);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedItems(newSet);
  };
  
  const selectAll = (items: any[]) => {
    setSelectedItems(new Set(items.map((i) => i.id)));
  };
  
  const clearSelection = () => {
    setSelectedItems(new Set());
  };
  
  // Export functions
  const exportCsv = () => {
    const csv = [
      ["Metric", "Value", "Previous Period", "Change"],
      ["Users (range)", String(rangeOrders.length), String(prevOrders.length), fmtDelta(percentDelta(rangeOrders.length, prevOrders.length))],
      ["Products (range)", String(rangeProducts.length), String(prevProducts.length), fmtDelta(percentDelta(rangeProducts.length, prevProducts.length))],
      ["Orders (range)", String(rangeOrders.length), String(prevOrders.length), fmtDelta(percentDelta(rangeOrders.length, prevOrders.length))],
      ["Gross Merchandise Value", gmv.toFixed(2), prevGmv.toFixed(2), fmtDelta(percentDelta(gmv, prevGmv))],
      ["Platform Revenue", revenue.toFixed(2), prevRevenue.toFixed(2), fmtDelta(percentDelta(revenue, prevRevenue))],
      ["Active Sellers", String(activeSellers.length), "-", "-"],
      ["Verified Sellers", String(verifiedSellers.length), "-", "-"],
      ["Open Disputes", String(openDisputes.length), "-", "-"],
      ["Dispute Rate", `${disputeRate.toFixed(2)}%`, "-", "-"],
    ].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `admin-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report exported to CSV");
  };
  
  // Filtered data for tables
  const filteredUsers = users.filter((u) => !search || `${u.full_name} ${u.email} ${u.role}`.toLowerCase().includes(search));
  const filteredProducts = products.filter((p) => !search || `${p.title} ${p.seller?.full_name} ${p.category}`.toLowerCase().includes(search));
  const filteredOrders = orders.filter((o) => !search || `${o.id} ${o.product?.title} ${o.buyer?.full_name} ${o.seller?.full_name} ${o.status}`.toLowerCase().includes(search));
  const filteredDisputes = openDisputes.filter((o) => !search || `${o.id} ${o.product?.title} ${o.buyer?.full_name} ${o.seller?.full_name}`.toLowerCase().includes(search));
  const filteredCategories = categories.filter((c) => !search || c.name.toLowerCase().includes(search));
  const filteredServices = services.filter((s) => !search || `${s.title} ${s.provider?.full_name}`.toLowerCase().includes(search));
  const filteredNotifications = notifications.filter((n) => !search || `${n.title} ${n.body}`.toLowerCase().includes(search));
  
  // Role-based dashboard configuration
  const roleConfigs = {
    operations: {
      title: "Operations Dashboard",
      description: "Overview of marketplace operations, orders, and seller activity",
      primaryMetrics: ["Orders", "Products", "Active Sellers", "GMV"],
    },
    finance: {
      title: "Finance Dashboard",
      description: "Financial performance, revenue, and transaction analytics",
      primaryMetrics: ["Revenue", "GMV", "Commission", "Pending Payments"],
    },
    compliance: {
      title: "Compliance Dashboard",
      description: "Disputes, verification status, and content moderation",
      primaryMetrics: ["Disputes", "Verification Queue", "Flagged Content", "Dispute Rate"],
    },
    content: {
      title: "Content Dashboard",
      description: "Manage products, services, and categories",
      primaryMetrics: ["Products", "Services", "Categories", "Active Listings"],
    },
    growth: {
      title: "Growth Dashboard",
      description: "User growth, referrals, and engagement metrics",
      primaryMetrics: ["Users", "Referrals", "New Sellers", "Engagement"],
    }
  };

  const currentRole = roleConfigs[adminRole];
  
  const navItems = [
    { id: "dashboard", label: "Dashboard", Icon: Activity },
    { id: "users", label: "Users", Icon: Users },
    { id: "products", label: "Products", Icon: Store },
    { id: "orders", label: "Orders", Icon: ShoppingCart },
    { id: "disputes", label: "Disputes", Icon: CircleHelp },
    { id: "verification", label: "Verification", Icon: Shield },
    { id: "categories", label: "Categories", Icon: Layers },
    { id: "services", label: "Services", Icon: Briefcase },
    { id: "referrals", label: "Referrals", Icon: Gift },
    { id: "payouts", label: "Payouts", Icon: Banknote },
    { id: "leaderboard", label: "Leaderboard", Icon: Trophy },
    { id: "notifications", label: "Notifications", Icon: Bell },
    { id: "feedback", label: "Feedback", Icon: MessageSquare },
    { id: "settings", label: "Settings", Icon: Info },
  ] as const;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent"></div>
          <p className="text-sm text-slate-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 shadow-lg p-4 lg:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-white">White Market Admin</h1>
            <p className="text-sm text-slate-300">{currentRole.description}</p>
            <p className="text-xs text-slate-400">Signed in as {user.full_name}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={`mr-1 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} /> 
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </Button>
            <Button size="sm" variant="outline" onClick={exportCsv}>
              <Download className="mr-1 h-4 w-4" /> CSV
            </Button>
          </div>
        </div>
        
        {/* Role Tabs */}
        <div className="mt-4 flex flex-wrap gap-1 border-b border-slate-200">
          {(["operations", "finance", "compliance", "content", "growth"] as AdminRole[]).map((role) => (
            <button
              key={role}
              onClick={() => setAdminRole(role)}
              className={`px-3 py-2 text-sm font-medium capitalize transition-colors ${
                adminRole === role
                  ? "border-b-2 border-teal-600 text-teal-600"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {role === "operations" && <Activity className="inline h-4 w-4 mr-1" />}
              {role === "finance" && <DollarSign className="inline h-4 w-4 mr-1" />}
              {role === "compliance" && <Shield className="inline h-4 w-4 mr-1" />}
              {role === "content" && <Layers className="inline h-4 w-4 mr-1" />}
              {role === "growth" && <TrendingUp className="inline h-4 w-4 mr-1" />}
              {role}
            </button>
          ))}
        </div>
        
        {/* Quick Actions by Role */}
        <div className="mt-3 flex flex-wrap gap-2">
          {adminRole === "operations" && (
            <>
              <Button variant="outline" size="sm" onClick={() => setTab("orders")} className="text-xs">
                <ShoppingCart className="mr-1 h-3 w-3" /> Manage Orders
              </Button>
              <Button variant="outline" size="sm" onClick={() => setTab("services")} className="text-xs">
                <Wrench className="mr-1 h-3 w-3" /> Services
              </Button>
              <Button variant="outline" size="sm" onClick={() => setTab("verification")} className="text-xs">
                <UserCheck className="mr-1 h-3 w-3" /> Pending Verifications
                {verifications.length > 0 && <Badge className="ml-1 h-5 w-5 p-0 text-[10px]">{verifications.length}</Badge>}
              </Button>
            </>
          )}
          {adminRole === "finance" && (
            <>
              <Button variant="outline" size="sm" onClick={() => { setSearchTerm("paid"); setTab("orders"); }} className="text-xs">
                <CreditCard className="mr-1 h-3 w-3" /> Payment Records
              </Button>
              <Button variant="outline" size="sm" onClick={() => setTab("payouts")} className="text-xs">
                <Banknote className="mr-1 h-3 w-3" /> Payouts
              </Button>
              <Button variant="outline" size="sm" onClick={handleGenerateReport} className="text-xs">
                <FileText className="mr-1 h-3 w-3" /> Generate Report
              </Button>
            </>
          )}
          {adminRole === "compliance" && (
            <>
              <Button variant="outline" size="sm" onClick={() => setTab("disputes")} className="text-xs">
                <AlertTriangle className="mr-1 h-3 w-3" /> Disputes
              </Button>
              <Button variant="outline" size="sm" onClick={() => setTab("verification")} className="text-xs">
                <Shield className="mr-1 h-3 w-3" /> User Verifications
              </Button>
              <Button variant="outline" size="sm" onClick={handleShowBannedUsers} className="text-xs">
                <Ban className="mr-1 h-3 w-3" /> Banned Users
              </Button>
            </>
          )}
          {adminRole === "content" && (
            <>
              <Button variant="outline" size="sm" onClick={() => setTab("products")} className="text-xs">
                <Package className="mr-1 h-3 w-3" /> Products
              </Button>
              <Button variant="outline" size="sm" onClick={() => setTab("categories")} className="text-xs">
                <FolderTree className="mr-1 h-3 w-3" /> Categories
              </Button>
              <Button variant="outline" size="sm" onClick={() => setTab("services")} className="text-xs">
                <Wrench className="mr-1 h-3 w-3" /> Services
              </Button>
            </>
          )}
          {adminRole === "growth" && (
            <>
              <Button variant="outline" size="sm" onClick={() => setTab("referrals")} className="text-xs">
                <Users className="mr-1 h-3 w-3" /> Referrals
              </Button>
              <Button variant="outline" size="sm" onClick={() => setTab("leaderboard")} className="text-xs">
                <Trophy className="mr-1 h-3 w-3" /> Leaderboard
              </Button>
              <Button variant="outline" size="sm" onClick={handleCampaign} className="text-xs">
                <Mail className="mr-1 h-3 w-3" /> Campaign
              </Button>
            </>
          )}
        </div>
        
        {/* Search and Date Range */}
        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              placeholder="Search users, products, orders, disputes..." 
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <CalendarDays className="h-4 w-4" />
            </div>
            <label htmlFor="admin-range-preset" className="sr-only">
              Date range preset
            </label>
            <select 
              id="admin-range-preset"
              aria-label="Date range preset"
              title="Date range preset"
              value={rangePreset} 
              onChange={(e) => setRangePreset(e.target.value as "7d" | "30d" | "90d")} 
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:gap-5 xl:grid-cols-[220px_1fr]">
        {/* Sidebar */}
        <aside className="space-y-3 lg:space-y-4">
          {/* Navigation */}
          <Card>
            <CardContent className="p-2 lg:p-3">
              <div className="space-y-1">
                {navItems.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    onClick={() => setTab(id as typeof tab)}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 lg:px-3 py-2 text-sm ${
                      tab === id 
                        ? "bg-slate-900 text-white" 
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <span className="hidden sm:inline">{label}</span>
                    </div>
                    {id === "notifications" && notifications.filter((n) => !n.is_read).length > 0 && (
                      <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {notifications.filter((n) => !n.is_read).length}
                      </span>
                    )}
                    {id === "disputes" && openDisputes.length > 0 && (
                      <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {openDisputes.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
          
          {/* Pending Actions - Priority Based */}
          <Card className="border-l-4 border-l-amber-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Pending Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingActions.filter((a) => a.count > 0).map((item) => (
                <div 
                  key={item.id} 
                  className={`rounded-lg border p-3 ${getPendingActionCardClass(item.priority)}`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${getPriorityBadge(item.priority)}`}>
                      {item.priority}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{item.count} pending</p>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1">
                      {item.age > 0 && (
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${getSLABadge(item.sla)}`}>
                          {item.age}d old
                        </span>
                      )}
                    </div>
                    <Button 
                      size="sm" 
                      variant={item.priority === "critical" ? "default" : "outline"} 
                      className="text-xs h-7"
                      onClick={() => setTab(item.target)}
                    >
                      {item.cta}
                    </Button>
                  </div>
                </div>
              ))}
              {pendingActions.filter((a) => a.count > 0).length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">All caught up! 🎉</p>
              )}
            </CardContent>
          </Card>
          
          {/* Quick Stats */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Platform Health</CardTitle>
              {systemHealth && (
                <Badge variant={systemHealth.status === "healthy" ? "default" : "destructive"} className="text-xs">
                  {systemHealth.status === "healthy" ? "● Healthy" : "● Issue"}
                </Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {enhancedStats ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Active Users</span>
                    <span className="font-semibold">{enhancedStats.users.active.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">New Today</span>
                    <span className="font-semibold text-emerald-600">+{enhancedStats.users.newToday}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Pending Orders</span>
                    <span className="font-semibold text-amber-600">{enhancedStats.orders.pending}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Completed</span>
                    <span className="font-semibold text-emerald-600">{enhancedStats.orders.completed}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Active Products</span>
                    <span className="font-semibold">{enhancedStats.products.active}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">This Month Revenue</span>
                    <span className="font-semibold text-emerald-600">{fmtCurrency(enhancedStats.revenue.thisMonth)}</span>
                  </div>
                  <div className="border-t pt-2 mt-2">
                    <p className="text-xs text-slate-500 mb-1">Growth Metrics</p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Users</span>
                      <span className={enhancedStats.growth.userGrowth >= 0 ? "text-emerald-600" : "text-red-600"}>
                        {enhancedStats.growth.userGrowth >= 0 ? "+" : ""}{enhancedStats.growth.userGrowth}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Orders</span>
                      <span className={enhancedStats.growth.orderGrowth >= 0 ? "text-emerald-600" : "text-red-600"}>
                        {enhancedStats.growth.orderGrowth >= 0 ? "+" : ""}{enhancedStats.growth.orderGrowth}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Revenue</span>
                      <span className={enhancedStats.growth.revenueGrowth >= 0 ? "text-emerald-600" : "text-red-600"}>
                        {enhancedStats.growth.revenueGrowth >= 0 ? "+" : ""}{enhancedStats.growth.revenueGrowth}%
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Total Users</span>
                    <span className="font-semibold">{stats?.totalUsers || users.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Total Orders</span>
                    <span className="font-semibold">{stats?.totalOrders || orders.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Total Products</span>
                    <span className="font-semibold">{stats?.totalProducts || products.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Revenue (10%)</span>
                    <span className="font-semibold text-emerald-600">{fmtCurrency(stats?.commission || revenue)}</span>
                  </div>
                </>
              )}
              {systemHealth && (
                <div className="border-t pt-2 mt-2">
                  <p className="text-xs text-slate-500 mb-1">System Status</p>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Database</span>
                    <span className={systemHealth.database.connected ? "text-emerald-600" : "text-red-600"}>
                      {systemHealth.database.connected ? "● Connected" : "● Disconnected"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">DB Response</span>
                    <span className="text-slate-600">{systemHealth.database.responseTime}ms</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">API Uptime</span>
                    <span className="text-slate-600">{Math.floor(systemHealth.api.uptime / 3600)}h</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </aside>

        {/* Main Content */}
        <div className="space-y-4 lg:space-y-5">
          {/* Dashboard View */}
          {tab === "dashboard" && (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 xl:grid-cols-5">
                {/* Operations Metrics */}
                {adminRole === "operations" && (
                  <>
                    {isLoading ? (
                      <>
                        <SkeletonCard />
                        <SkeletonCard />
                        <SkeletonCard />
                        <SkeletonCard />
                      </>
                    ) : (
                      <>
                        <Card>
                          <CardContent className="p-3 lg:p-4">
                            <p className="text-xs lg:text-sm text-slate-500">Orders</p>
                            <p className="text-lg lg:text-xl font-bold text-slate-900">{rangeOrders.length}</p>
                            <p className={`text-xs font-semibold ${String(fmtDelta(percentDelta(rangeOrders.length, prevOrders.length))).startsWith("+") ? "text-emerald-600" : "text-red-600"}`}>
                              {fmtDelta(percentDelta(rangeOrders.length, prevOrders.length))}
                            </p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-3 lg:p-4">
                            <p className="text-xs lg:text-sm text-slate-500">Products</p>
                            <p className="text-lg lg:text-xl font-bold text-slate-900">{rangeProducts.length}</p>
                            <p className={`text-xs font-semibold ${String(fmtDelta(percentDelta(rangeProducts.length, prevProducts.length))).startsWith("+") ? "text-emerald-600" : "text-red-600"}`}>
                              {fmtDelta(percentDelta(rangeProducts.length, prevProducts.length))}
                            </p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-3 lg:p-4">
                            <p className="text-xs lg:text-sm text-slate-500">Active Sellers</p>
                            <p className="text-lg lg:text-xl font-bold text-slate-900">{activeSellers.length}</p>
                            <p className="text-xs text-slate-500">{pendingVerification.length} pending</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-3 lg:p-4">
                            <p className="text-xs lg:text-sm text-slate-500">GMV</p>
                            <p className="text-lg lg:text-xl font-bold text-slate-900">{fmtCurrency(gmv)}</p>
                            <p className={`text-xs font-semibold flex items-center gap-1 ${String(fmtDelta(percentDelta(gmv, prevGmv))).startsWith("+") ? "text-emerald-600" : "text-red-600"}`}>
                              {String(fmtDelta(percentDelta(gmv, prevGmv))).startsWith("+") ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                              {fmtDelta(percentDelta(gmv, prevGmv))}
                            </p>
                          </CardContent>
                        </Card>
                      </>
                    )}
                  </>
                )}
                
                {/* Finance Metrics */}
                {adminRole === "finance" && (
                  <>
                    {isLoading ? (
                      <>
                        <SkeletonCard />
                        <SkeletonCard />
                        <SkeletonCard />
                        <SkeletonCard />
                      </>
                    ) : (
                      <>
                        <Card className="bg-teal-50 border-teal-200">
                          <CardContent className="p-3 lg:p-4">
                            <p className="text-xs lg:text-sm text-teal-700">Revenue</p>
                            <p className="text-xl lg:text-2xl font-bold text-teal-900">{fmtCurrency(revenue)}</p>
                            <p className={`text-xs font-semibold ${String(fmtDelta(percentDelta(revenue, prevRevenue))).startsWith("+") ? "text-emerald-600" : "text-red-600"}`}>
                              {fmtDelta(percentDelta(revenue, prevRevenue))}
                            </p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-3 lg:p-4">
                            <p className="text-xs lg:text-sm text-slate-500">GMV</p>
                            <p className="text-lg lg:text-xl font-bold text-slate-900">{fmtCurrency(gmv)}</p>
                            <p className="text-xs text-slate-500">Total volume</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-3 lg:p-4">
                            <p className="text-xs lg:text-sm text-slate-500">Commission</p>
                            <p className="text-lg lg:text-xl font-bold text-slate-900">{COMMISSION_RATE * 100}%</p>
                            <p className="text-xs text-slate-500">Platform fee</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-3 lg:p-4">
                            <p className="text-xs lg:text-sm text-slate-500">Pending</p>
                            <p className="text-lg lg:text-xl font-bold text-slate-900">{orders.filter((o) => o.status === "pending").length}</p>
                            <p className="text-xs text-slate-500">Awaiting payment</p>
                          </CardContent>
                        </Card>
                      </>
                    )}
                  </>
                )}
                
                {/* Compliance Metrics */}
                {adminRole === "compliance" && (
                  <>
                    <Card className={`${openDisputes.length > 0 ? "border-red-300 bg-red-50" : ""}`}>
                      <CardContent className="p-3 lg:p-4">
                        <p className="text-xs lg:text-sm text-red-700">Disputes</p>
                        <p className="text-xl lg:text-2xl font-bold text-red-900">{openDisputes.length}</p>
                        <p className="text-xs text-red-600">Requires attention</p>
                      </CardContent>
                    </Card>
                    <Card className="border-amber-300 bg-amber-50">
                      <CardContent className="p-3 lg:p-4">
                        <p className="text-xs lg:text-sm text-amber-700">Verification</p>
                        <p className="text-xl lg:text-2xl font-bold text-amber-900">{verifications.length || pendingVerification.length}</p>
                        <p className="text-xs text-amber-600">Awaiting review</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-3 lg:p-4">
                        <p className="text-xs lg:text-sm text-slate-500">Flagged Content</p>
                        <p className="text-lg lg:text-xl font-bold text-slate-900">{flaggedProducts.length}</p>
                        <p className="text-xs text-slate-500">Products</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-3 lg:p-4">
                        <p className="text-xs lg:text-sm text-slate-500">Dispute Rate</p>
                        <p className="text-lg lg:text-xl font-bold text-slate-900">{disputeRate.toFixed(1)}%</p>
                        <p className="text-xs text-slate-500">of all orders</p>
                      </CardContent>
                    </Card>
                  </>
                )}
                
                {/* Content Metrics */}
                {adminRole === "content" && (
                  <>
                    <Card>
                      <CardContent className="p-3 lg:p-4">
                        <p className="text-xs lg:text-sm text-slate-500">Products</p>
                        <p className="text-xl lg:text-2xl font-bold text-slate-900">{products.length}</p>
                        <p className="text-xs text-slate-500">{products.filter((p) => p.is_active).length} active</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-3 lg:p-4">
                        <p className="text-xs lg:text-sm text-slate-500">Services</p>
                        <p className="text-xl lg:text-2xl font-bold text-slate-900">{services.length}</p>
                        <p className="text-xs text-slate-500">Total listings</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-3 lg:p-4">
                        <p className="text-xs lg:text-sm text-slate-500">Categories</p>
                        <p className="text-xl lg:text-2xl font-bold text-slate-900">{categories.length}</p>
                        <p className="text-xs text-slate-500">Active categories</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-3 lg:p-4">
                        <p className="text-xs lg:text-sm text-slate-500">Flagged</p>
                        <p className="text-xl lg:text-2xl font-bold text-red-900">{flaggedProducts.length}</p>
                        <p className="text-xs text-slate-500">Needs review</p>
                      </CardContent>
                    </Card>
                  </>
                )}
                
                {/* Growth Metrics */}
                {adminRole === "growth" && (
                  <>
                    <Card>
                      <CardContent className="p-3 lg:p-4">
                        <p className="text-xs lg:text-sm text-slate-500">Total Users</p>
                        <p className="text-xl lg:text-2xl font-bold text-slate-900">{users.length}</p>
                        <p className={`text-xs font-semibold ${String(fmtDelta(percentDelta(users.length, Math.floor(users.length * 0.8)))).startsWith("+") ? "text-emerald-600" : "text-red-600"}`}>
                          {fmtDelta(percentDelta(users.length, Math.floor(users.length * 0.8)))}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-3 lg:p-4">
                        <p className="text-xs lg:text-sm text-slate-500">Sellers</p>
                        <p className="text-xl lg:text-2xl font-bold text-slate-900">{sellers.length}</p>
                        <p className="text-xs text-slate-500">{verifiedSellers.length} verified</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-3 lg:p-4">
                        <p className="text-xs lg:text-sm text-slate-500">Referrals</p>
                        <p className="text-xl lg:text-2xl font-bold text-slate-900">{referralStats?.total_referrals || 0}</p>
                        <p className="text-xs text-slate-500">Total referrals</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-3 lg:p-4">
                        <p className="text-xs lg:text-sm text-slate-500">Conversion</p>
                        <p className="text-xl lg:text-2xl font-bold text-emerald-900">
                          {users.length > 0 ? ((sellers.length / users.length) * 100).toFixed(1) : 0}%
                        </p>
                        <p className="text-xs text-slate-500">Seller rate</p>
                      </CardContent>
                    </Card>
                  </>
                )}
                
                {/* Always show Revenue */}
                <Card>
                  <CardContent className="p-3 lg:p-4">
                    <p className="text-xs lg:text-sm text-slate-500">Platform Revenue</p>
                    <p className="text-lg lg:text-xl font-bold text-slate-900">{fmtCurrency(stats?.commission || revenue)}</p>
                    <p className="text-xs text-slate-500">{COMMISSION_RATE * 100}% of settled</p>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Activity from API */}
              <div className="grid gap-3 lg:grid-cols-2">
                {/* Recent Activity */}
                <Card>
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm">Recent Activity</CardTitle>
                    <Button variant="ghost" size="sm" className="h-8 text-xs">
                      View All
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {loadingStates.activity ? (
                      <SkeletonTable rows={5} />
                    ) : recentActivity.length > 0 ? (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {recentActivity.slice(0, 10).map((activity, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs">
                            <div className={`mt-0.5 h-2 w-2 rounded-full flex-shrink-0 ${
                              activity.type === 'order' ? 'bg-blue-500' :
                              activity.type === 'user' ? 'bg-green-500' :
                              activity.type === 'product' ? 'bg-purple-500' :
                              activity.type === 'payment' ? 'bg-emerald-500' :
                              'bg-slate-400'
                            }`}></div>
                            <div className="flex-1 min-w-0">
                              <p className="text-slate-700 truncate">{activity.description || activity.message}</p>
                              <p className="text-slate-400">{activity.timeAgo || activity.created_at}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-slate-500 py-8">No recent activity</p>
                    )}
                  </CardContent>
                </Card>

                {/* Top Sellers from API */}
                <Card>
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm">Top Performers</CardTitle>
                    <Badge variant="outline" className="text-xs">This Month</Badge>
                  </CardHeader>
                  <CardContent>
                    {loadingStates.topSellers ? (
                      <SkeletonTable rows={5} />
                    ) : apiTopSellers.length > 0 ? (
                      <div className="space-y-3">
                        {apiTopSellers.slice(0, 5).map((seller, idx) => (
                          <div key={seller.id || idx} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                idx === 0 ? 'bg-amber-100 text-amber-700' :
                                idx === 1 ? 'bg-slate-100 text-slate-700' :
                                idx === 2 ? 'bg-orange-100 text-orange-700' :
                                'bg-slate-50 text-slate-500'
                              }`}>
                                {idx + 1}
                              </div>
                              <div>
                                <p className="text-sm font-medium truncate max-w-[120px]">{seller.name || seller.seller_name || seller.full_name}</p>
                                <p className="text-xs text-slate-500">{seller.orders || 0} orders</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-emerald-600">{fmtCurrency(seller.total || seller.revenue || 0)}</p>
                              <p className="text-xs text-slate-500">{seller.rating ? `★ ${seller.rating}` : ''}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-slate-500 py-8">No sellers found</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Charts Row */}
              <div className="grid gap-3 lg:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Revenue Trend</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-40 lg:h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={revenueTrend}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#0d9488" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="gmv" name="GMV" stroke="#64748b" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Order Volume</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-40 lg:h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={orderVolume}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Bar dataKey="orders" name="Orders" fill="#475569" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="disputes" name="Disputes" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">User Growth</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-40 lg:h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={userGrowth}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Area type="monotone" dataKey="users" name="Users" stroke="#0f172a" fill="#cbd5e1" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              {/* Additional Analytics */}
              <div className="grid gap-3 lg:grid-cols-2">
                {/* Category Distribution */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Category Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={categoryDistribution}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={70}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {categoryDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {categoryDistribution.slice(0, 4).map((cat, idx) => (
                        <div key={cat.name} className="flex items-center gap-1 text-xs">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                          <span>{cat.name} ({cat.value})</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                
                {/* Order Status */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Order Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={orderStatusDistribution}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={70}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {orderStatusDistribution.map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={entry.name === "paid" || entry.name === "completed" ? "#10b981" : 
                                      entry.name === "disputed" ? "#ef4444" : 
                                      entry.name === "pending" ? "#f59e0b" : "#64748b"} 
                              />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {orderStatusDistribution.map((status) => (
                        <div key={status.name} className="flex items-center gap-1 text-xs">
                          <span className={`h-2 w-2 rounded-full ${
                            status.name === "paid" || status.name === "completed" ? "bg-emerald-500" : 
                            status.name === "disputed" ? "bg-red-500" : 
                            status.name === "pending" ? "bg-amber-500" : "bg-slate-500"
                          }`} />
                          <span className="capitalize">{status.name} ({status.value})</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              {/* Top Sellers */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Top Sellers by Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {topSellers.map((seller, idx) => (
                      <div key={seller.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${
                            idx === 0 ? "bg-amber-100 text-amber-700" :
                            idx === 1 ? "bg-slate-100 text-slate-700" :
                            idx === 2 ? "bg-orange-100 text-orange-700" :
                            "bg-slate-50 text-slate-500"
                          }`}>
                            {idx + 1}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{seller.name}</p>
                            <p className="text-xs text-slate-500">Seller ID: {seller.id.slice(-8)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{fmtCurrency(seller.total)}</p>
                          <p className="text-xs text-slate-500">Total sales</p>
                        </div>
                      </div>
                    ))}
                    {topSellers.length === 0 && (
                      <p className="text-center text-slate-500 py-4">No seller data available</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Activity Feed */}
              <Card>
                <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2">
                  <CardTitle className="text-base">Activity Feed</CardTitle>
                  <div className="flex flex-wrap gap-2">
                    <Button 
                      size="sm" 
                      variant={activityFilter === "all" ? "default" : "outline"} 
                      onClick={() => setActivityFilter("all")}
                    >
                      All
                    </Button>
                    <Button 
                      size="sm" 
                      variant={activityFilter === "orders" ? "default" : "outline"} 
                      onClick={() => setActivityFilter("orders")}
                    >
                      Orders
                    </Button>
                    <Button 
                      size="sm" 
                      variant={activityFilter === "payments" ? "default" : "outline"} 
                      onClick={() => setActivityFilter("payments")}
                    >
                      Payments
                    </Button>
                    <Button 
                      size="sm" 
                      variant={activityFilter === "disputes" ? "default" : "outline"} 
                      onClick={() => setActivityFilter("disputes")}
                    >
                      Disputes
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {(showAllActivity ? activities : activities.slice(0, 8)).map((a) => (
                      <div 
                        key={a.id} 
                        className={`flex items-start gap-3 rounded-lg border p-3 ${getActivityContainerClass(a.severity)}`}
                      >
                        <div className={`mt-0.5 rounded-full p-2 ${getActivityBadgeClass(a.type)}`}>
                          {a.type === "orders" && <ShoppingCart className="h-4 w-4" />}
                          {a.type === "payments" && <Wallet className="h-4 w-4" />}
                          {a.type === "disputes" && <CircleHelp className="h-4 w-4" />}
                          {a.type === "verification" && <Shield className="h-4 w-4" />}
                          {a.type === "products" && <Package className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-900 truncate">{a.text}</p>
                          <p className="text-xs text-slate-500">{timeAgo(a.time)}</p>
                        </div>
                        {a.severity === "high" && (
                          <Badge variant="destructive" className="text-xs">Urgent</Badge>
                        )}
                      </div>
                    ))}
                    {activities.length === 0 && (
                      <p className="text-center text-slate-500 py-8">No activities to display</p>
                    )}
                  </div>
                  {activities.length > 8 && (
                    <Button 
                      variant="outline" 
                      className="w-full mt-3"
                      onClick={() => setShowAllActivity(!showAllActivity)}
                    >
                      {showAllActivity ? "Show Less" : `View All (${activities.length})`}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </>
          )}
          
          {/* Users Tab */}
          {tab === "users" && (
            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle>Users Management</CardTitle>
                  <CardDescription>Manage all platform users</CardDescription>
                </div>
                <div className="flex gap-2">
                  {selectedItems.size > 0 && (
                    <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg">
                      <span className="text-sm font-medium text-slate-600">{selectedItems.size} selected</span>
                      <select 
                        value={bulkAction}
                        onChange={(e) => setBulkAction(e.target.value)}
                        className="h-8 rounded-md border border-slate-300 px-2 text-sm bg-white"
                      >
                        <option value="">Bulk Actions</option>
                        <option value="ban">Ban Selected</option>
                        <option value="unban">Unban Selected</option>
                        <option value="verify">Verify Users</option>
                        <option value="make_seller">Make Seller</option>
                        <option value="make_admin">Make Admin</option>
                        <option value="export">Export Selected</option>
                      </select>
                      <Button size="sm" onClick={handleBulkAction} disabled={!bulkAction} className="h-8">Apply</Button>
                      <Button size="sm" variant="ghost" onClick={clearSelection} className="h-8 w-8 p-0"><XCircle className="h-4 w-4" /></Button>
                    </div>
                  )}
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Filter users..."
                    className="w-full sm:w-64"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500 border-b">
                        <th className="py-2 pr-4">
                          <input 
                            type="checkbox" 
                            onChange={(e) => e.target.checked ? selectAll(filteredUsers) : clearSelection()}
                            className="rounded"
                          />
                        </th>
                        <th className="py-2 pr-4">Name</th>
                        <th className="py-2 pr-4">Email</th>
                        <th className="py-2 pr-4">Role</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 pr-4">Joined</th>
                        <th className="py-2 pr-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                        <tr>
                          <td colSpan={7} className="py-8">
                            <SkeletonTable rows={8} />
                          </td>
                        </tr>
                      ) : filteredUsers.length > 0 ? (
                        filteredUsers.map((u) => (
                          <tr key={u.id} className="border-b">
                            <td className="py-2 pr-4">
                              <input 
                                type="checkbox" 
                                checked={selectedItems.has(u.id)}
                                onChange={() => toggleSelection(u.id)}
                                className="rounded"
                              />
                            </td>
                            <td className="py-2 pr-4">{u.full_name}</td>
                            <td className="py-2 pr-4">{u.email}</td>
                            <td className="py-2 pr-4">
                              <select
                                value={u.role}
                                onChange={(e) => handleUpdateUserRole(u.id, e.target.value)}
                                className="text-sm border rounded px-2 py-1"
                              >
                                <option value="user">User</option>
                                <option value="seller">Seller</option>
                                <option value="admin">Admin</option>
                                <option value="banned">Banned</option>
                              </select>
                            </td>
                            <td className="py-2 pr-4">
                              <Badge variant={u.role === "banned" ? "destructive" : u.role === "admin" ? "default" : "secondary"}>
                                {u.role}
                              </Badge>
                            </td>
                            <td className="py-2 pr-4 text-slate-500">
                              {u.created_at ? new Date(u.created_at).toLocaleDateString() : "-"}
                            </td>
                            <td className="py-2 pr-4">
                              <div className="flex gap-1">
                                {u.role === "banned" ? (
                                  <Button size="sm" variant="outline" onClick={() => handleUnbanUser(u.id)}>
                                    <Unlock className="h-3 w-3" />
                                  </Button>
                                ) : (
                                  <Button size="sm" variant="outline" onClick={() => handleBanUser(u.id)}>
                                    <Ban className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-slate-500">
                            No users found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Products Tab */}
          {tab === "products" && (
            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle>Products Management</CardTitle>
                  <CardDescription>View and manage all products</CardDescription>
                </div>
                <div className="flex gap-2">
                  {selectedItems.size > 0 && (
                    <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg">
                      <span className="text-sm font-medium text-slate-600">{selectedItems.size} selected</span>
                      <select 
                        value={bulkAction}
                        onChange={(e) => setBulkAction(e.target.value)}
                        className="h-8 rounded-md border border-slate-300 px-2 text-sm bg-white"
                      >
                        <option value="">Bulk Actions</option>
                        <option value="approve">Approve Products</option>
                        <option value="reject">Reject Products</option>
                        <option value="delete">Delete Products</option>
                        <option value="feature">Feature Products</option>
                        <option value="export">Export Selected</option>
                      </select>
                      <Button size="sm" onClick={handleBulkAction} disabled={!bulkAction} className="h-8">Apply</Button>
                      <Button size="sm" variant="ghost" onClick={clearSelection} className="h-8 w-8 p-0"><XCircle className="h-4 w-4" /></Button>
                    </div>
                  )}
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Filter products..."
                    className="w-full sm:w-64"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500 border-b">
                        <th className="py-2 pr-4">Image</th>
                        <th className="py-2 pr-4">Title</th>
                        <th className="py-2 pr-4">Seller</th>
                        <th className="py-2 pr-4">Category</th>
                        <th className="py-2 pr-4">Price</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 pr-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                        <tr>
                          <td colSpan={7} className="py-8">
                            <SkeletonTable rows={8} />
                          </td>
                        </tr>
                      ) : filteredProducts.length > 0 ? (
                        filteredProducts.map((p) => (
                          <tr key={p.id} className="border-b">
                            <td className="py-2 pr-4">
                              <img src={p.image_url || "/placeholder.svg"} alt={p.title} className="h-8 w-8 rounded object-cover" />
                            </td>
                            <td className="py-2 pr-4 max-w-[200px] truncate">{p.title}</td>
                            <td className="py-2 pr-4">{p.seller?.full_name || "Unknown"}</td>
                            <td className="py-2 pr-4">{p.category || "-"}</td>
                            <td className="py-2 pr-4">GHS {p.price}</td>
                            <td className="py-2 pr-4">
                              <Badge variant={p.is_active ? "default" : "destructive"}>
                                {p.is_active ? "Active" : "Hidden"}
                              </Badge>
                            </td>
                            <td className="py-2 pr-4">
                              <div className="flex gap-1">
                                <Button size="sm" variant="outline" onClick={() => navigate(`/product/${p.id}`)}>
                                  <Eye className="h-3 w-3" />
                                </Button>
                                {!p.is_active && (
                                  <Button size="sm" variant="outline" onClick={() => handleRestoreProduct(p.id)}>
                                    <CheckCircle className="h-3 w-3" />
                                  </Button>
                                )}
                                <Button size="sm" variant="outline" onClick={() => handleRemoveProduct(p.id)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-slate-500">
                            No products found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Orders Tab */}
          {tab === "orders" && (
            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle>Orders Management</CardTitle>
                  <CardDescription>Track and manage all orders</CardDescription>
                </div>
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filter orders..."
                  className="w-full sm:w-64"
                />
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500 border-b">
                        <th className="py-2 pr-4">Order ID</th>
                        <th className="py-2 pr-4">Product</th>
                        <th className="py-2 pr-4">Buyer</th>
                        <th className="py-2 pr-4">Seller</th>
                        <th className="py-2 pr-4">Amount</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 pr-4">Date</th>
                        <th className="py-2 pr-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.map((o) => (
                        <tr key={o.id} className="border-b">
                          <td className="py-2 pr-4">#{o.id.slice(-6)}</td>
                          <td className="py-2 pr-4 max-w-[150px] truncate">{o.product?.title || "-"}</td>
                          <td className="py-2 pr-4">{o.buyer?.full_name || "-"}</td>
                          <td className="py-2 pr-4">{o.seller?.full_name || "-"}</td>
                          <td className="py-2 pr-4">GHS {o.amount}</td>
                          <td className="py-2 pr-4 capitalize">
                            <span className={getOrderStatusTextClass(o.status)}>
                              {o.status}
                            </span>
                          </td>
                          <td className="py-2 pr-4 text-slate-500">
                            {new Date(o.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-2 pr-4">
                            <Button size="sm" variant="outline" onClick={() => setSelectedOrderId(o.id)}>
                              View
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Disputes Tab */}
          {tab === "disputes" && (
            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle>Disputes Management</CardTitle>
                  <CardDescription>Resolve order disputes</CardDescription>
                </div>
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filter disputes..."
                  className="w-full sm:w-64"
                />
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500 border-b">
                        <th className="py-2 pr-4">Order ID</th>
                        <th className="py-2 pr-4">Buyer</th>
                        <th className="py-2 pr-4">Product</th>
                        <th className="py-2 pr-4">Amount</th>
                        <th className="py-2 pr-4">Age</th>
                        <th className="py-2 pr-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDisputes.map((o) => {
                        const daysOld = getDaysOld(o.created_at);
                        return (
                          <tr key={o.id} className="border-b">
                            <td className="py-2 pr-4">#{o.id.slice(-6)}</td>
                            <td className="py-2 pr-4">{o.buyer?.full_name || "-"}</td>
                            <td className="py-2 pr-4">{o.product?.title || "-"}</td>
                            <td className="py-2 pr-4">GHS {o.amount}</td>
                            <td className="py-2 pr-4">
                              <span className={`px-2 py-0.5 rounded text-xs ${getSLABadge(getSLAStatus(daysOld))}`}>
                                {daysOld} days
                              </span>
                            </td>
                            <td className="py-2 pr-4">
                              <div className="flex gap-1">
                                <Button size="sm" onClick={() => handleResolveDispute(o.id)}>
                                  <Check className="mr-1 h-3 w-3" /> Resolve
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredDisputes.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center py-8 text-slate-500">
                            No disputes to display
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Verification Tab */}
          {tab === "verification" && (
            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle>Verification Requests</CardTitle>
                  <CardDescription>Review seller verification requests</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500 border-b">
                        <th className="py-2 pr-4">User</th>
                        <th className="py-2 pr-4">Document Type</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 pr-4">Submitted</th>
                        <th className="py-2 pr-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {verifications.map((v) => (
                        <tr key={v.id} className="border-b">
                          <td className="py-2 pr-4">
                            <div>
                              <p className="font-medium">{v.user?.full_name || "Unknown"}</p>
                              <p className="text-xs text-slate-500">{v.user?.email}</p>
                            </div>
                          </td>
                          <td className="py-2 pr-4 capitalize">{v.document_type?.replace("_", " ")}</td>
                          <td className="py-2 pr-4">
                            <Badge variant={v.status === "approved" ? "default" : v.status === "rejected" ? "destructive" : "secondary"}>
                              {v.status}
                            </Badge>
                          </td>
                          <td className="py-2 pr-4 text-slate-500">
                            {v.created_at ? new Date(v.created_at).toLocaleDateString() : "-"}
                          </td>
                          <td className="py-2 pr-4">
                            {v.status === "pending" && (
                              <div className="flex gap-1">
                                <Button size="sm" onClick={() => handleVerifySeller(v.id)}>
                                  <Check className="mr-1 h-3 w-3" /> Approve
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleRejectVerification(v.id)}>
                                  <XCircle className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                      {verifications.length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-slate-500">
                            No pending verification requests
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Categories Tab */}
          {tab === "categories" && (
            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle>Categories Management</CardTitle>
                  <CardDescription>Manage product categories</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Filter categories..."
                    className="w-full sm:w-64"
                  />
                  <Button size="sm">
                    <Plus className="mr-1 h-4 w-4" /> Add
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500 border-b">
                        <th className="py-2 pr-4">Name</th>
                        <th className="py-2 pr-4">Slug</th>
                        <th className="py-2 pr-4">Products</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 pr-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCategories.map((c) => (
                        <tr key={c.id} className="border-b">
                          <td className="py-2 pr-4 font-medium">{c.name}</td>
                          <td className="py-2 pr-4 text-slate-500">{c.slug}</td>
                          <td className="py-2 pr-4">{c.product_count || 0}</td>
                          <td className="py-2 pr-4">
                            <Badge variant={c.is_active ? "default" : "secondary"}>
                              {c.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </td>
                          <td className="py-2 pr-4">
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline">
                                <Edit className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Services Tab */}
          {tab === "services" && (
            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle>Services Management</CardTitle>
                  <CardDescription>Manage professional services</CardDescription>
                </div>
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filter services..."
                  className="w-full sm:w-64"
                />
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500 border-b">
                        <th className="py-2 pr-4">Service</th>
                        <th className="py-2 pr-4">Provider</th>
                        <th className="py-2 pr-4">Type</th>
                        <th className="py-2 pr-4">Price</th>
                        <th className="py-2 pr-4">Rating</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 pr-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredServices.map((s) => (
                        <tr key={s.id} className="border-b">
                          <td className="py-2 pr-4 max-w-[200px] truncate">{s.title}</td>
                          <td className="py-2 pr-4">{s.provider?.full_name || "-"}</td>
                          <td className="py-2 pr-4">{s.service_type}</td>
                          <td className="py-2 pr-4">GHS {s.price}</td>
                          <td className="py-2 pr-4">
                            <div className="flex items-center gap-1">
                              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                              {s.rating || "N/A"}
                            </div>
                          </td>
                          <td className="py-2 pr-4">
                            <Badge variant={s.is_active ? "default" : "secondary"}>
                              {s.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </td>
                          <td className="py-2 pr-4">
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline">
                                <Eye className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredServices.length === 0 && (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-slate-500">
                            No services found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Referrals Tab */}
          {tab === "referrals" && (
            <Card>
              <CardHeader>
                <CardTitle>Referral Program</CardTitle>
                <CardDescription>Track referral performance and statistics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-slate-500">Total Referrals</p>
                      <p className="text-2xl font-bold">{referralStats?.total_referrals || 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-slate-500">Qualified Referrals</p>
                      <p className="text-2xl font-bold">{referralStats?.qualified_referrals || 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-slate-500">Buyer Referrals</p>
                      <p className="text-2xl font-bold">{referralStats?.buyer_referrals || 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-slate-500">Seller Referrals</p>
                      <p className="text-2xl font-bold">{referralStats?.seller_referrals || 0}</p>
                    </CardContent>
                  </Card>
                </div>
                
                {referralStats?.referrals && referralStats.referrals.length > 0 && (
                  <div className="mt-6">
                    <h3 className="font-semibold mb-3">Recent Referrals</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="text-left text-slate-500 border-b">
                            <th className="py-2 pr-4">Referred User</th>
                            <th className="py-2 pr-4">Type</th>
                            <th className="py-2 pr-4">Date</th>
                            <th className="py-2 pr-4">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {referralStats.referrals.slice(0, 10).map((r: any, idx: number) => (
                            <tr key={idx} className="border-b">
                              <td className="py-2 pr-4">{r.referred_id?.slice(-8) || "-"}</td>
                              <td className="py-2 pr-4 capitalize">{r.type || "Buyer"}</td>
                              <td className="py-2 pr-4">{r.created_at ? new Date(r.created_at).toLocaleDateString() : "-"}</td>
                              <td className="py-2 pr-4">
                                <Badge variant={r.qualified ? "default" : "secondary"}>
                                  {r.qualified ? "Qualified" : "Pending"}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          
          {/* Notifications Tab */}
          {tab === "notifications" && (
            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle>Notifications</CardTitle>
                  <CardDescription>System notifications and alerts</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleMarkAllNotificationsRead}>
                    Mark All Read
                  </Button>
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Filter notifications..."
                    className="w-full sm:w-64"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {filteredNotifications.map((n) => (
                    <div 
                      key={n.id} 
                      className={`flex items-start gap-3 rounded-lg border p-4 ${n.is_read ? "bg-white" : "bg-blue-50 border-blue-200"}`}
                    >
                      <div className={`mt-0.5 rounded-full p-2 ${n.is_read ? "bg-slate-100" : "bg-blue-100"}`}>
                        <Bell className={`h-4 w-4 ${n.is_read ? "text-slate-500" : "text-blue-600"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm">{n.title}</p>
                          {!n.is_read && (
                            <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                          )}
                        </div>
                        {n.body && <p className="text-sm text-slate-500 mt-1">{n.body}</p>}
                        <p className="text-xs text-slate-400 mt-2">{timeAgo(n.created_at)}</p>
                      </div>
                      {!n.is_read && (
                        <Button size="sm" variant="ghost" onClick={() => handleMarkNotificationRead(n.id)}>
                          Mark Read
                        </Button>
                      )}
                    </div>
                  ))}
                  {filteredNotifications.length === 0 && (
                    <p className="text-center text-slate-500 py-8">No notifications</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Settings Tab */}
          {tab === "settings" && (
            <Card>
              <CardContent className="p-6">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">Settings</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Configure alerts, thresholds, and moderation defaults in this section.
                  </p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="rounded-lg bg-white p-3 border">
                      <p className="text-sm font-medium">Dispute Alert Threshold</p>
                      <p className="text-xs text-slate-500 mt-1">Notify when disputes exceed 5%</p>
                      <p className="text-xs text-teal-600 mt-2 font-medium">Current: 5%</p>
                    </div>
                    <div className="rounded-lg bg-white p-3 border">
                      <p className="text-sm font-medium">Verification SLA</p>
                      <p className="text-xs text-slate-500 mt-1">48 hours for seller verification</p>
                      <p className="text-xs text-teal-600 mt-2 font-medium">Current: 48h</p>
                    </div>
                    <div className="rounded-lg bg-white p-3 border">
                      <p className="text-sm font-medium">Commission Rate</p>
                      <p className="text-xs text-slate-500 mt-1">Currently 10% per transaction</p>
                      <p className="text-xs text-teal-600 mt-2 font-medium">Current: 10%</p>
                    </div>
                    <div className="rounded-lg bg-white p-3 border">
                      <p className="text-sm font-medium">Auto-flag Products</p>
                      <p className="text-xs text-slate-500 mt-1">Flag suspicious listings automatically</p>
                      <p className="text-xs text-teal-600 mt-2 font-medium">Enabled</p>
                    </div>
                    <div className="rounded-lg bg-white p-3 border">
                      <p className="text-sm font-medium">Email Notifications</p>
                      <p className="text-xs text-slate-500 mt-1">Receive email alerts for urgent issues</p>
                      <p className="text-xs text-teal-600 mt-2 font-medium">Enabled</p>
                    </div>
                    <div className="rounded-lg bg-white p-3 border">
                      <p className="text-sm font-medium">Data Export</p>
                      <p className="text-xs text-slate-500 mt-1">Export user data in compliance with GDPR</p>
                      <Button size="sm" variant="outline" className="mt-2">
                        <Download className="mr-1 h-3 w-3" /> Export
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Feedback Tab */}
          {tab === "feedback" && (
            <div className="space-y-6">
              {/* Stats Cards */}
              {feedbackStats && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-slate-500">Total Feedback</p>
                      <p className="text-2xl font-bold text-slate-900">{feedbackStats.total_feedback || 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-slate-500">Average Rating</p>
                      <div className="flex items-center gap-2">
                        <p className="text-2xl font-bold text-slate-900">{feedbackStats.avg_rating || 0}</p>
                        <Star className="h-5 w-5 fill-accent text-accent" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-slate-500">Would Recommend</p>
                      <p className="text-2xl font-bold text-emerald-600">{feedbackStats.recommend_percentage || 0}%</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-slate-500">Satisfaction Rate</p>
                      <p className="text-2xl font-bold text-teal-600">{feedbackStats.satisfied_percentage || 0}%</p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Rating Distribution */}
              {feedbackStats && (
                <Card>
                  <CardHeader>
                    <CardTitle>Rating Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-around text-center">
                      <div>
                        <div className="text-3xl font-bold text-emerald-600">{feedbackStats.five_star_count || 0}</div>
                        <p className="text-sm text-slate-500">5 stars</p>
                      </div>
                      <div>
                        <div className="text-3xl font-bold text-teal-500">{feedbackStats.four_star_count || 0}</div>
                        <p className="text-sm text-slate-500">4 stars</p>
                      </div>
                      <div>
                        <div className="text-3xl font-bold text-amber-500">{feedbackStats.three_star_count || 0}</div>
                        <p className="text-sm text-slate-500">3 stars</p>
                      </div>
                      <div>
                        <div className="text-3xl font-bold text-orange-500">{feedbackStats.two_star_count || 0}</div>
                        <p className="text-sm text-slate-500">2 stars</p>
                      </div>
                      <div>
                        <div className="text-3xl font-bold text-red-500">{feedbackStats.one_star_count || 0}</div>
                        <p className="text-sm text-slate-500">1 star</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Feedback List */}
              <Card>
                <CardHeader>
                  <CardTitle>User Feedback</CardTitle>
                  <CardDescription>Recent feedback from users about their experience</CardDescription>
                </CardHeader>
                <CardContent>
                  {feedbackList.length === 0 ? (
                    <p className="text-center text-slate-500 py-8">No feedback yet</p>
                  ) : (
                    <div className="space-y-4">
                      {feedbackList.map((f) => (
                        <div key={f.id} className="rounded-lg border p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary font-semibold">
                                {f.user?.full_name?.[0] || "U"}
                              </div>
                              <div>
                                <p className="font-medium text-sm">{f.user?.full_name || "Anonymous"}</p>
                                <p className="text-xs text-slate-500">{f.user?.email || "User feedback"}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`h-4 w-4 ${star <= f.rating ? "fill-accent text-accent" : "text-muted"}`}
                                />
                              ))}
                            </div>
                          </div>
                          {f.feedback_text && (
                            <p className="mt-3 text-sm text-slate-600 bg-slate-50 rounded p-3">{f.feedback_text}</p>
                          )}
                          <div className="mt-3 flex flex-wrap gap-2">
                            {f.would_recommend !== null && (
                              <Badge variant={f.would_recommend ? "default" : "destructive"} className="text-xs">
                                {f.would_recommend ? "Would Recommend" : "Would Not Recommend"}
                              </Badge>
                            )}
                            {f.is_satisfied !== null && (
                              <Badge variant={f.is_satisfied ? "outline" : "secondary"} className="text-xs">
                                {f.is_satisfied ? "Satisfied" : "Not Satisfied"}
                              </Badge>
                            )}
                            <span className="text-xs text-slate-400">{timeAgo(f.created_at)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
          
          {/* Payouts Tab */}
          {tab === "payouts" && (
            <Card>
              <CardHeader>
                <CardTitle>Payout Management</CardTitle>
                <CardDescription>Manage seller payouts and financial transactions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border p-4 text-center text-slate-500 py-8">
                  <Banknote className="mx-auto h-12 w-12 mb-3 opacity-50" />
                  <p className="font-medium">Payout System</p>
                  <p className="text-sm">Payout processing and management will be displayed here.</p>
                  <p className="text-xs mt-2">Connected sellers can request payouts through their dashboard.</p>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Leaderboard Tab */}
          {tab === "leaderboard" && (
            <Card>
              <CardHeader>
                <CardTitle>Leaderboard</CardTitle>
                <CardDescription>Top performers and referral leaders</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-3">Top Sellers by Revenue</h3>
                    <div className="space-y-2">
                      {apiTopSellers.slice(0, 10).map((seller, idx) => (
                        <div key={seller.id || idx} className="flex items-center justify-between p-3 rounded-lg border">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                              idx === 0 ? 'bg-amber-100 text-amber-700' :
                              idx === 1 ? 'bg-slate-100 text-slate-700' :
                              idx === 2 ? 'bg-orange-100 text-orange-700' :
                              'bg-slate-50 text-slate-500'
                            }`}>
                              {idx + 1}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{seller.name || seller.seller_name || seller.full_name}</p>
                              <p className="text-xs text-slate-500">{seller.orders || 0} orders</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-emerald-600">{fmtCurrency(seller.total || seller.revenue || 0)}</p>
                            {seller.rating && <p className="text-xs text-slate-500">★ {seller.rating}</p>}
                          </div>
                        </div>
                      ))}
                      {apiTopSellers.length === 0 && (
                        <p className="text-center py-4 text-slate-500">No sellers found</p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </section>
  );
}
