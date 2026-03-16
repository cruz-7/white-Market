// cspell:ignore momo
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { 
  CalendarDays, CircleHelp, Download, FileText, Info, Search, ShoppingCart, Store, UserRound, Wallet,
  AlertTriangle, CheckCircle,
  Shield, DollarSign, Activity, Package, Eye, ArrowUpRight, ArrowDownRight
} from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Input } from "./input";
import { Badge } from "./badge";
import { 
  LocalUser, 
  getOrders, 
  getProducts, 
  getUsers, 
  saveOrders, 
  saveProducts,
  saveUsers,
  timeAgo 
} from "./data";

type Props = Readonly<{
  user: LocalUser;
}>;

type AdminRole = "operations" | "finance" | "compliance";
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
  target: "disputes" | "verification" | "products" | "orders";
  description: string;
};

const DAY_MS = 86400000;
const COMMISSION_RATE = 0.1; // 10% platform fee

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

function getFlaggedContentPriority(count: number): PriorityLevel {
  if (count > 3) return "high";
  if (count > 0) return "medium";
  return "low";
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
  if (status === "completed") return "text-emerald-600";
  if (status === "disputed") return "text-red-600";
  if (status === "pending") return "text-amber-600";
  return "text-slate-600";
}

export default function AdminDashboardView({ user }: Props) {
  const navigate = useNavigate();
  
  // State
  const [adminRole, setAdminRole] = useState<AdminRole>("operations");
  const [tab, setTab] = useState<"dashboard" | "users" | "products" | "orders" | "disputes" | "verification" | "settings">("dashboard");
  const [searchTerm, setSearchTerm] = useState("");
  const [activityFilter, setActivityFilter] = useState<ActivityType>("all");
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [rangePreset, setRangePreset] = useState<"7d" | "30d" | "90d">("30d");
  
  // Data
  const users = getUsers();
  const products = getProducts();
  const orders = getOrders();
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
  const rangeProducts = products.filter((p) => inRange(p.listed_at, startDate, endDate));
  const prevProducts = products.filter((p) => inRange(p.listed_at, prevStart, prevEnd));
  
  // Financial calculations
  const gmv = rangeOrders.reduce((sum, o) => sum + o.amount, 0);
  const prevGmv = prevOrders.reduce((sum, o) => sum + o.amount, 0);
  const revenue = rangeOrders.filter((o) => settledStatuses.has(o.status)).reduce((sum, o) => sum + o.amount * COMMISSION_RATE, 0);
  const prevRevenue = prevOrders.filter((o) => settledStatuses.has(o.status)).reduce((sum, o) => sum + o.amount * COMMISSION_RATE, 0);
  
  // Seller metrics
  const sellers = users.filter((u) => u.role === "seller");
  const activeSellers = sellers.filter((s) => products.some((p) => p.sellerId === s.id && p.is_active));
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
  
  // Activities feed
  const activities = useMemo(() => {
    const items: ActivityItem[] = [
      ...orders.map((o) => ({ 
        id: `order-${o.id}`, 
        type: "orders" as const, 
        text: `Order #${o.id.slice(-6)} created - ${o.productTitle} (${o.buyerName})`, 
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
        text: `âš ï¸ Dispute raised on Order #${o.id.slice(-6)} - ${o.productTitle}`, 
        time: o.created_at,
        severity: "high" as const
      })),
      ...rangeProducts.map((p) => ({
        id: `product-${p.id}`,
        type: "products" as const,
        text: `Seller "${p.sellerName}" listed "${p.title}" in ${p.category}`,
        time: p.listed_at,
        severity: (p.is_active ? "normal" : "warning") as ActivitySeverity
      })),
      ...pendingVerification.map((s) => ({
        id: `verify-${s.id}`,
        type: "verification" as const,
        text: `Seller "${s.full_name}" awaiting verification`,
        time: now.toISOString(),
        severity: "warning" as const
      }))
    ]
    .sort((a, b) => +new Date(b.time) - +new Date(a.time))
    .filter((a) => activityFilter === "all" || a.type === activityFilter)
    .filter((a) => search.length === 0 || a.text.toLowerCase().includes(search));
    
    return items;
  }, [orders, openDisputes, rangeProducts, pendingVerification, activityFilter, search]);
  
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
      count: pendingVerification.length, 
      priority: getVerificationPriority(pendingVerification.length), 
      updatedAt: now.toISOString(),
      age: pendingVerification.length,
      sla: getVerificationSla(pendingVerification.length),
      cta: "Review", 
      target: "verification" as const,
      description: "Sellers awaiting identity verification"
    },
    { 
      id: "flagged-products", 
      label: "Flagged Content", 
      count: flaggedProducts.length, 
      priority: getFlaggedContentPriority(flaggedProducts.length), 
      updatedAt: products[0]?.listed_at || now.toISOString(),
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
  ], [openDisputes, pendingVerification, flaggedProducts, orders, products]);
  
  // Quick actions
  const handleResolveDispute = (orderId: string) => {
    saveOrders(getOrders().map((o) => (o.id === orderId ? { ...o, status: "completed" as const } : o)));
    toast.success(`Dispute on order #${orderId.slice(-6)} resolved`);
  };
  
const handleVerifySeller = (sellerId: string) => {
    const updatedUsers = users.map((u) => 
      u.id === sellerId ? { ...u, momo_number: "verified" } : u
    );
    saveUsers(updatedUsers);
    toast.success("Seller verified successfully");
  };
  
  const handleRestoreProduct = (productId: string) => {
    saveProducts(products.map((p) => 
      p.id === productId ? { ...p, is_active: true } : p
    ));
    toast.success("Product restored successfully");
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
  
  const exportPdf = () => {
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return toast.error("Allow pop-ups to export PDF");
    const doc = win.document;
    doc.title = "White Market Admin Report";
    if (doc.body) {
      doc.body.innerHTML = "";
      const container = doc.createElement("div");
      container.innerHTML = `
        <h1>White Market Admin Report</h1>
        <p>Generated: ${new Date().toLocaleString()}</p>
        <h2>Financial Summary</h2>
        <p>GMV: ${fmtCurrency(gmv)}</p>
        <p>Platform Revenue: ${fmtCurrency(revenue)}</p>
        <p>Commission (${COMMISSION_RATE * 100}%)</p>
        <h2>Operations</h2>
        <p>Orders: ${rangeOrders.length}</p>
        <p>Products: ${rangeProducts.length}</p>
        <p>Active Sellers: ${activeSellers.length}</p>
        <h2>Quality Metrics</h2>
        <p>Dispute Rate: ${disputeRate.toFixed(2)}%</p>
        <p>Flagged Content: ${flaggedProducts.length}</p>
      `;
      doc.body.appendChild(container);
    }
    win.print();
    toast.success("PDF report generated");
  };
  
  // Filtered data for tables
  const filteredUsers = users.filter((u) => !search || `${u.full_name} ${u.email} ${u.role}`.toLowerCase().includes(search));
  const filteredProducts = products.filter((p) => !search || `${p.title} ${p.sellerName} ${p.category}`.toLowerCase().includes(search));
  const filteredOrders = orders.filter((o) => !search || `${o.id} ${o.productTitle} ${o.buyerName} ${o.sellerName} ${o.status}`.toLowerCase().includes(search));
  const filteredDisputes = openDisputes.filter((o) => !search || `${o.id} ${o.productTitle} ${o.buyerName} ${o.sellerName}`.toLowerCase().includes(search));
  
  // Get priority badge styling
  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "critical": return "bg-red-100 text-red-700 border-red-200";
      case "high": return "bg-orange-100 text-orange-700 border-orange-200";
      case "medium": return "bg-amber-100 text-amber-700 border-amber-200";
      default: return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };
  
  // Get SLA badge styling
  const getSLABadge = (sla: string) => {
    switch (sla) {
      case "critical": return "bg-red-500 text-white";
      case "warning": return "bg-amber-500 text-white";
      default: return "bg-emerald-500 text-white";
    }
  };

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
    }
  };

  const currentRole = roleConfigs[adminRole];
  const navItems = [
    { id: "dashboard", label: "Dashboard", Icon: Activity },
    { id: "users", label: "Users", Icon: UserRound },
    { id: "products", label: "Products", Icon: Store },
    { id: "orders", label: "Orders", Icon: ShoppingCart },
    { id: "disputes", label: "Disputes", Icon: CircleHelp },
    { id: "verification", label: "Verification", Icon: Shield },
    { id: "settings", label: "Settings", Icon: Info },
  ] as const;

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
            <Button size="sm" variant="outline" onClick={exportCsv}>
              <Download className="mr-1 h-4 w-4" /> CSV
            </Button>
            <Button size="sm" variant="outline" onClick={exportPdf}>
              <FileText className="mr-1 h-4 w-4" /> PDF
            </Button>
          </div>
        </div>
        
        {/* Role Tabs */}
        <div className="mt-4 flex flex-wrap gap-1 border-b border-slate-200">
          {(["operations", "finance", "compliance"] as AdminRole[]).map((role) => (
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
              {role}
            </button>
          ))}
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
                    className={`flex w-full items-center gap-2 rounded-lg px-2 lg:px-3 py-2 text-sm ${
                      tab === id 
                        ? "bg-slate-900 text-white" 
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{label}</span>
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
              {pendingActions.map((item) => (
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
            </CardContent>
          </Card>
        </aside>

        {/* Main Content */}
        <div className="space-y-4 lg:space-y-5">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 xl:grid-cols-5">
            {/* Operations Metrics */}
            {adminRole === "operations" && (
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
            
            {/* Finance Metrics */}
            {adminRole === "finance" && (
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
                    <p className="text-xl lg:text-2xl font-bold text-amber-900">{pendingVerification.length}</p>
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
            
            {/* Always show GMV and Revenue */}
            <Card>
              <CardContent className="p-3 lg:p-4">
                <p className="text-xs lg:text-sm text-slate-500">Platform Revenue</p>
                <p className="text-lg lg:text-xl font-bold text-slate-900">{fmtCurrency(revenue)}</p>
                <p className="text-xs text-slate-500">{COMMISSION_RATE * 100}% of settled</p>
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
                <Button 
                  size="sm" 
                  variant={activityFilter === "verification" ? "default" : "outline"} 
                  onClick={() => setActivityFilter("verification")}
                >
                  Verification
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

          {/* Data Tables */}
          {tab !== "dashboard" && tab !== "settings" && (
            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <CardTitle className="capitalize">{tab}</CardTitle>
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={`Filter ${tab}...`}
                  className="w-full sm:w-64"
                />
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      {tab === "users" && (
                        <tr className="text-left text-slate-500 border-b">
                          <th className="py-2 pr-4">Name</th>
                          <th className="py-2 pr-4">Email</th>
                          <th className="py-2 pr-4">Role</th>
                          <th className="py-2 pr-4">Status</th>
                          <th className="py-2 pr-4">Actions</th>
                        </tr>
                      )}
                      {tab === "products" && (
                        <tr className="text-left text-slate-500 border-b">
                          <th className="py-2 pr-4">Image</th>
                          <th className="py-2 pr-4">Title</th>
                          <th className="py-2 pr-4">Seller</th>
                          <th className="py-2 pr-4">Price</th>
                          <th className="py-2 pr-4">Status</th>
                          <th className="py-2 pr-4">Actions</th>
                        </tr>
                      )}
                      {tab === "orders" && (
                        <tr className="text-left text-slate-500 border-b">
                          <th className="py-2 pr-4">Order ID</th>
                          <th className="py-2 pr-4">Buyer</th>
                          <th className="py-2 pr-4">Seller</th>
                          <th className="py-2 pr-4">Amount</th>
                          <th className="py-2 pr-4">Status</th>
                          <th className="py-2 pr-4">Actions</th>
                        </tr>
                      )}
                      {tab === "disputes" && (
                        <tr className="text-left text-slate-500 border-b">
                          <th className="py-2 pr-4">Order ID</th>
                          <th className="py-2 pr-4">Buyer</th>
                          <th className="py-2 pr-4">Product</th>
                          <th className="py-2 pr-4">Age</th>
                          <th className="py-2 pr-4">Actions</th>
                        </tr>
                      )}
                      {tab === "verification" && (
                        <tr className="text-left text-slate-500 border-b">
                          <th className="py-2 pr-4">Name</th>
                          <th className="py-2 pr-4">Email</th>
                          <th className="py-2 pr-4">Registered</th>
                          <th className="py-2 pr-4">Actions</th>
                        </tr>
                      )}
                    </thead>
                    <tbody>
                      {tab === "users" && filteredUsers.map((u) => (
                        <tr key={u.id} className="border-b">
                          <td className="py-2 pr-4">{u.full_name}</td>
                          <td className="py-2 pr-4">{u.email}</td>
                          <td className="py-2 pr-4 capitalize">{u.role}</td>
                          <td className="py-2 pr-4">
                            {u.role === "seller" ? (
                              <span className={u.momo_number ? "text-emerald-600" : "text-amber-600"}>
                                {u.momo_number ? "Verified" : "Pending"}
                              </span>
                            ) : "-"}
                          </td>
                          <td className="py-2 pr-4">
                            <Button size="sm" variant="outline" onClick={() => navigate("/profile-setup")}>
                              Manage
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {tab === "products" && filteredProducts.map((p) => (
                        <tr key={p.id} className="border-b">
                          <td className="py-2 pr-4">
                            <img src={p.image} alt={p.title} className="h-8 w-8 rounded object-cover" />
                          </td>
                          <td className="py-2 pr-4">{p.title}</td>
                          <td className="py-2 pr-4">{p.sellerName}</td>
                          <td className="py-2 pr-4">GHS {p.price}</td>
                          <td className="py-2 pr-4">
                            <span className={p.is_active ? "text-emerald-600" : "text-red-600"}>
                              {p.is_active ? "Active" : "Hidden"}
                            </span>
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
                            </div>
                          </td>
                        </tr>
                      ))}
                      {tab === "orders" && filteredOrders.map((o) => (
                        <tr key={o.id} className="border-b">
                          <td className="py-2 pr-4">#{o.id.slice(-6)}</td>
                          <td className="py-2 pr-4">{o.buyerName}</td>
                          <td className="py-2 pr-4">{o.sellerName}</td>
                          <td className="py-2 pr-4">GHS {o.amount}</td>
                          <td className="py-2 pr-4 capitalize">
                            <span className={getOrderStatusTextClass(o.status)}>
                              {o.status}
                            </span>
                          </td>
                          <td className="py-2 pr-4">
                            <Button size="sm" variant="outline" onClick={() => navigate(`/orders/${o.id}/track`)}>
                              Open
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {tab === "disputes" && filteredDisputes.map((o) => {
                        const daysOld = getDaysOld(o.created_at);
                        return (
                          <tr key={o.id} className="border-b">
                            <td className="py-2 pr-4">#{o.id.slice(-6)}</td>
                            <td className="py-2 pr-4">{o.buyerName}</td>
                            <td className="py-2 pr-4">{o.productTitle}</td>
                            <td className="py-2 pr-4">
                              <span className={`px-2 py-0.5 rounded text-xs ${getSLABadge(getSLAStatus(daysOld))}`}>
                                {daysOld} days
                              </span>
                            </td>
                            <td className="py-2 pr-4">
                              <Button size="sm" onClick={() => handleResolveDispute(o.id)}>
                                Resolve
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                      {tab === "verification" && pendingVerification.map((s) => (
                        <tr key={s.id} className="border-b">
                          <td className="py-2 pr-4">{s.full_name}</td>
                          <td className="py-2 pr-4">{s.email}</td>
                          <td className="py-2 pr-4">{new Date(s.created_at || now).toLocaleDateString()}</td>
                          <td className="py-2 pr-4">
                            <Button size="sm" onClick={() => handleVerifySeller(s.id)}>
                              <CheckCircle className="mr-1 h-3 w-3" /> Verify
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
                    </div>
                    <div className="rounded-lg bg-white p-3 border">
                      <p className="text-sm font-medium">Verification SLA</p>
                      <p className="text-xs text-slate-500 mt-1">48 hours for seller verification</p>
                    </div>
                    <div className="rounded-lg bg-white p-3 border">
                      <p className="text-sm font-medium">Commission Rate</p>
                      <p className="text-xs text-slate-500 mt-1">Currently 10% per transaction</p>
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

