import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, CircleHelp, Download, FileText, Info, Search, ShoppingCart, Store, UserRound, Wallet } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

import { Button } from "./button";
import { Card, CardContent } from "./card";
import { Input } from "./input";
import { LocalUser, getOrders, getProducts, getUsers, saveOrders, timeAgo } from "./data";

type Props = {
  user: LocalUser;
};

const DAY_MS = 86400000;

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

export default function AdminDashboardView({ user }: Props) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"users" | "products" | "orders" | "disputes" | "settings">("users");
  const [searchTerm, setSearchTerm] = useState("");
  const [activityFilter, setActivityFilter] = useState<"all" | "orders" | "payments" | "disputes">("all");
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [rangePreset, setRangePreset] = useState<"7d" | "30d" | "90d" | "custom">("30d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const users = getUsers();
  const products = getProducts();
  const orders = getOrders();
  const now = new Date();

  let startDate = new Date(now.getTime() - 29 * DAY_MS);
  let endDate = now;
  if (rangePreset === "7d") startDate = new Date(now.getTime() - 6 * DAY_MS);
  if (rangePreset === "90d") startDate = new Date(now.getTime() - 89 * DAY_MS);
  if (rangePreset === "custom") {
    startDate = customStart ? new Date(`${customStart}T00:00:00`) : startDate;
    endDate = customEnd ? new Date(`${customEnd}T23:59:59`) : endDate;
  }
  if (+startDate > +endDate) {
    const temp = startDate;
    startDate = endDate;
    endDate = temp;
  }

  const rangeSpan = Math.max(DAY_MS, +endDate - +startDate + 1);
  const prevEnd = new Date(+startDate - 1);
  const prevStart = new Date(+prevEnd - rangeSpan + 1);
  const settledStatuses = new Set<string>(["paid", "completed"]);
  const search = searchTerm.toLowerCase().trim();

  const usersWithCreated = users.map((u, idx) => ({
    ...u,
    created_at: (u as LocalUser & { created_at?: string }).created_at || new Date(now.getTime() - (users.length - idx + 1) * 5 * DAY_MS).toISOString(),
  }));

  const rangeOrders = orders.filter((o) => inRange(o.created_at, startDate, endDate));
  const prevOrders = orders.filter((o) => inRange(o.created_at, prevStart, prevEnd));
  const rangeProducts = products.filter((p) => inRange(p.listed_at, startDate, endDate));
  const prevProducts = products.filter((p) => inRange(p.listed_at, prevStart, prevEnd));
  const rangeUsers = usersWithCreated.filter((u) => inRange(u.created_at, startDate, endDate));
  const prevUsers = usersWithCreated.filter((u) => inRange(u.created_at, prevStart, prevEnd));
  const openDisputes = orders.filter((o) => o.status === "disputed");
  const gmv = rangeOrders.reduce((sum, o) => sum + o.amount, 0);
  const prevGmv = prevOrders.reduce((sum, o) => sum + o.amount, 0);
  const revenue = rangeOrders.filter((o) => settledStatuses.has(o.status)).reduce((sum, o) => sum + o.amount * 0.1, 0);
  const prevRevenue = prevOrders.filter((o) => settledStatuses.has(o.status)).reduce((sum, o) => sum + o.amount * 0.1, 0);

  const dayKeys: string[] = [];
  for (let d = new Date(startDate); +d <= +endDate; d = new Date(+d + DAY_MS)) dayKeys.push(d.toISOString().slice(0, 10));
  const revenueTrend = dayKeys.map((day) => {
    const dayOrders = rangeOrders.filter((o) => o.created_at.startsWith(day));
    const dayGmv = dayOrders.reduce((sum, o) => sum + o.amount, 0);
    const dayRevenue = dayOrders.filter((o) => settledStatuses.has(o.status)).reduce((sum, o) => sum + o.amount * 0.1, 0);
    return { day: day.slice(5), gmv: +dayGmv.toFixed(2), revenue: +dayRevenue.toFixed(2) };
  });
  const orderVolume = dayKeys.map((day) => {
    const dayOrders = rangeOrders.filter((o) => o.created_at.startsWith(day));
    return { day: day.slice(5), orders: dayOrders.length, disputes: dayOrders.filter((o) => o.status === "disputed").length };
  });
  const userGrowth = dayKeys.map((day) => {
    const dayEnd = new Date(`${day}T23:59:59`);
    return { day: day.slice(5), users: usersWithCreated.filter((u) => +new Date(u.created_at) <= +dayEnd).length };
  });

  const activities = [
    ...orders.map((o) => ({ id: `order-${o.id}`, type: "orders" as const, text: `Order #${o.id} created for ${o.productTitle}`, time: o.created_at })),
    ...orders.filter((o) => settledStatuses.has(o.status)).map((o) => ({ id: `payment-${o.id}`, type: "payments" as const, text: `Payment settled for Order #${o.id}`, time: o.created_at })),
    ...openDisputes.map((o) => ({ id: `dispute-${o.id}`, type: "disputes" as const, text: `Dispute opened on Order #${o.id}`, time: o.created_at })),
  ]
    .sort((a, b) => +new Date(b.time) - +new Date(a.time))
    .filter((a) => (activityFilter === "all" ? true : a.type === activityFilter))
    .filter((a) => (!search ? true : a.text.toLowerCase().includes(search)));

  const pendingActions = [
    { id: "disputes", label: "Open disputes", count: openDisputes.length, priority: openDisputes.length ? "High" : "Low", updatedAt: openDisputes[0]?.created_at || now.toISOString(), cta: "Resolve", target: "disputes" as const },
    { id: "pending-orders", label: "Orders pending payment", count: orders.filter((o) => o.status === "pending").length, priority: "Medium", updatedAt: orders[0]?.created_at || now.toISOString(), cta: "Review", target: "orders" as const },
    { id: "seller-verification", label: "Sellers awaiting verification", count: users.filter((u) => u.role === "seller" && !u.momo_number).length, priority: "Medium", updatedAt: now.toISOString(), cta: "Review", target: "users" as const },
    { id: "reported-products", label: "Reported / hidden products", count: products.filter((p) => !p.is_active).length, priority: "Low", updatedAt: products[0]?.listed_at || now.toISOString(), cta: "Review", target: "products" as const },
  ];

  const resolveDispute = (orderId: string) => {
    saveOrders(getOrders().map((o) => (o.id === orderId ? { ...o, status: "confirmed" as const } : o)));
    toast.success(`Dispute on order #${orderId} marked resolved`);
  };

  const exportCsv = () => {
    const csv = [
      ["Metric", "Value"],
      ["Users (range)", String(rangeUsers.length)],
      ["Products (range)", String(rangeProducts.length)],
      ["Orders (range)", String(rangeOrders.length)],
      ["Gross Merchandise Value", gmv.toFixed(2)],
      ["Platform Revenue", revenue.toFixed(2)],
      ["Open Disputes", String(openDisputes.length)],
    ].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `admin-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return toast.error("Allow pop-ups to export PDF");
    win.document.write(`<h1>White Market Admin Report</h1><p>Generated: ${new Date().toLocaleString()}</p><p>GMV: ${fmtCurrency(gmv)}</p><p>Revenue: ${fmtCurrency(revenue)}</p>`);
    win.document.close();
    win.print();
  };

  const filteredUsers = users.filter((u) => !search || `${u.full_name} ${u.email} ${u.role}`.toLowerCase().includes(search));
  const filteredProducts = products.filter((p) => !search || `${p.title} ${p.sellerName} ${p.category}`.toLowerCase().includes(search));
  const filteredOrders = orders.filter((o) => !search || `${o.id} ${o.productTitle} ${o.buyerName} ${o.sellerName} ${o.status}`.toLowerCase().includes(search));
  const filteredDisputes = openDisputes.filter((o) => !search || `${o.id} ${o.productTitle} ${o.buyerName} ${o.sellerName}`.toLowerCase().includes(search));

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="page-title">Admin Dashboard</h1>
            <p className="body-text">Professional operations overview with consistent data across cards, feed, and actions.</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={exportCsv}><Download className="mr-1 h-4 w-4" /> CSV</Button>
            <Button size="sm" variant="outline" onClick={exportPdf}><FileText className="mr-1 h-4 w-4" /> PDF</Button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search users, products, orders, disputes..." className="pl-9" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-lg border bg-slate-50 px-3 py-2 text-xs text-slate-600"><CalendarDays className="h-4 w-4" /> Date range</div>
            <select value={rangePreset} onChange={(e) => setRangePreset(e.target.value as "7d" | "30d" | "90d" | "custom")} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm">
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="custom">Custom</option>
            </select>
            {rangePreset === "custom" && (<><Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="h-10 w-[150px]" /><Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="h-10 w-[150px]" /></>)}
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-4">
          <Card><CardContent className="p-3 space-y-1">{[
            ["users", "Users", <UserRound className="h-4 w-4" />],
            ["products", "Products", <Store className="h-4 w-4" />],
            ["orders", "Orders", <ShoppingCart className="h-4 w-4" />],
            ["disputes", "Disputes", <CircleHelp className="h-4 w-4" />],
            ["settings", "Settings", <Info className="h-4 w-4" />],
          ].map(([id, label, icon]) => <button key={String(id)} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm ${tab === id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`} onClick={() => setTab(id as any)}>{icon}{label}</button>)}</CardContent></Card>
          <Card><CardContent className="space-y-2 p-4"><h2 className="section-title text-base">Pending Actions</h2>{pendingActions.map((item) => <div key={item.id} className="rounded-lg border border-slate-200 p-3"><div className="flex items-center justify-between"><p className="text-sm font-semibold">{item.label}</p><span className={`rounded-full px-2 py-0.5 text-[11px] ${item.priority === "High" ? "bg-red-100 text-red-700" : item.priority === "Medium" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{item.priority}</span></div><p className="text-xs text-slate-500">{item.count} pending</p><p className="text-xs text-slate-400" title={new Date(item.updatedAt).toLocaleString()}>{timeAgo(item.updatedAt)} • {new Date(item.updatedAt).toLocaleString()}</p><Button size="sm" className="mt-2" variant="outline" onClick={() => setTab(item.target)}>{item.cta}</Button></div>)}</CardContent></Card>
        </aside>

        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[
            ["Users (Range)", String(rangeUsers.length), fmtDelta(percentDelta(rangeUsers.length, prevUsers.length)), "New user accounts in selected range"],
            ["Products (Range)", String(rangeProducts.length), fmtDelta(percentDelta(rangeProducts.length, prevProducts.length)), "Products created in selected range"],
            ["Orders (Range)", String(rangeOrders.length), fmtDelta(percentDelta(rangeOrders.length, prevOrders.length)), "Orders created in selected range"],
            ["Gross Merchandise Value", fmtCurrency(gmv), fmtDelta(percentDelta(gmv, prevGmv)), "Total order value before fees"],
            ["Platform Revenue", fmtCurrency(revenue), fmtDelta(percentDelta(revenue, prevRevenue)), "Estimated 10% fee on settled orders"],
          ].map(([title, value, delta, help]) => <Card key={String(title)}><CardContent className="p-4"><p className="label-text">{String(title)}</p><p className="mt-1 text-xl font-bold text-slate-900">{String(value)}</p><p className={`text-xs font-semibold ${String(delta).startsWith("+") ? "text-emerald-600" : "text-red-600"}`}>{String(delta)} vs previous</p><p className="mt-1 text-xs text-slate-500">{String(help)}</p></CardContent></Card>)}</div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2"><CardContent className="p-4"><div className="mb-3 flex items-center justify-between"><h2 className="section-title">Recent Activity Feed</h2><button className="text-sm text-slate-600 hover:underline" onClick={() => setShowAllActivity((v) => !v)}>{showAllActivity ? "Collapse" : "View All"}</button></div><div className="mb-3 flex gap-2">{(["all", "orders", "payments", "disputes"] as const).map((f) => <Button key={f} size="sm" variant={activityFilter === f ? "default" : "outline"} onClick={() => setActivityFilter(f)}>{f === "all" ? "All" : f[0].toUpperCase() + f.slice(1)}</Button>)}</div><div className="space-y-2">{(showAllActivity ? activities : activities.slice(0, 6)).map((a) => <div key={a.id} className="flex items-start gap-3 rounded-lg border border-slate-200 p-3"><div className={`mt-0.5 rounded-full p-2 ${a.type === "orders" ? "bg-slate-100 text-slate-700" : a.type === "payments" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{a.type === "orders" ? <ShoppingCart className="h-4 w-4" /> : a.type === "payments" ? <Wallet className="h-4 w-4" /> : <CircleHelp className="h-4 w-4" />}</div><div><p className="text-sm text-slate-900">{a.text}</p><p className="text-xs text-slate-500" title={new Date(a.time).toLocaleString()}>{timeAgo(a.time)} • {new Date(a.time).toLocaleString()}</p></div></div>)}</div></CardContent></Card>
            <Card><CardContent className="p-4"><h2 className="section-title mb-2">Data Consistency</h2><p className="text-sm text-slate-600">Open disputes and dispute activities are now sourced from the same orders dataset.</p><div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm"><p><span className="font-semibold">Open disputes:</span> {openDisputes.length}</p><p><span className="font-semibold">Feed dispute events:</span> {activities.filter((a) => a.type === "disputes").length}</p></div></CardContent></Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card><CardContent className="p-4"><h2 className="section-title mb-2">Revenue Trend</h2><div className="h-48"><ResponsiveContainer width="100%" height="100%"><LineChart data={revenueTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" /><YAxis /><Tooltip /><Line type="monotone" dataKey="revenue" stroke="#0f766e" strokeWidth={2} /><Line type="monotone" dataKey="gmv" stroke="#334155" strokeWidth={1.8} /></LineChart></ResponsiveContainer></div></CardContent></Card>
            <Card><CardContent className="p-4"><h2 className="section-title mb-2">Order Volume</h2><div className="h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={orderVolume}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" /><YAxis /><Tooltip /><Bar dataKey="orders" fill="#334155" /><Bar dataKey="disputes" fill="#f59e0b" /></BarChart></ResponsiveContainer></div></CardContent></Card>
            <Card><CardContent className="p-4"><h2 className="section-title mb-2">User Growth Curve</h2><div className="h-48"><ResponsiveContainer width="100%" height="100%"><AreaChart data={userGrowth}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" /><YAxis /><Tooltip /><Area type="monotone" dataKey="users" stroke="#0f172a" fill="#cbd5e1" /></AreaChart></ResponsiveContainer></div></CardContent></Card>
          </div>

          <Card><CardContent className="p-6">{tab !== "settings" ? <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead>{tab === "users" && <tr className="text-left text-slate-500"><th className="py-2">Name</th><th>Email</th><th>Role</th><th>Verified</th><th>Joined</th><th>Actions</th></tr>}{tab === "products" && <tr className="text-left text-slate-500"><th className="py-2">Image</th><th>Title</th><th>Seller</th><th>Price</th><th>Status</th><th>Actions</th></tr>}{tab === "orders" && <tr className="text-left text-slate-500"><th className="py-2">Order ID</th><th>Buyer</th><th>Seller</th><th>Amount</th><th>Status</th><th>Actions</th></tr>}{tab === "disputes" && <tr className="text-left text-slate-500"><th className="py-2">Order ID</th><th>Raised By</th><th>Reason</th><th>Status</th><th>Resolve</th></tr>}</thead><tbody>{tab === "users" && filteredUsers.map((u) => <tr key={u.id} className="border-t"><td className="py-2">{u.full_name}</td><td>{u.email}</td><td>{u.role}</td><td>{u.role === "seller" ? "Yes" : "-"}</td><td>{new Date().toLocaleDateString()}</td><td><Button size="sm" variant="outline" onClick={() => navigate("/profile-setup")}>Manage</Button></td></tr>)}{tab === "products" && filteredProducts.map((p) => <tr key={p.id} className="border-t"><td className="py-2"><img src={p.image} className="h-8 w-8 rounded object-cover" /></td><td>{p.title}</td><td>{p.sellerName}</td><td>GHS {p.price}</td><td>{p.is_active ? "active" : "hidden"}</td><td><Button size="sm" variant="outline" onClick={() => navigate(`/product/${p.id}`)}>Review</Button></td></tr>)}{tab === "orders" && filteredOrders.map((o) => <tr key={o.id} className="border-t"><td className="py-2">#{o.id}</td><td>{o.buyerName}</td><td>{o.sellerName}</td><td>GHS {o.amount}</td><td className="capitalize">{o.status}</td><td><Button size="sm" variant="outline" onClick={() => navigate(`/orders/${o.id}/track`)}>Open</Button></td></tr>)}{tab === "disputes" && filteredDisputes.map((o) => <tr key={o.id} className="border-t"><td className="py-2">#{o.id}</td><td>{o.buyerName}</td><td>Product mismatch</td><td className="capitalize">{o.status}</td><td><Button size="sm" onClick={() => resolveDispute(o.id)}>Resolve</Button></td></tr>)}</tbody></table></div> : <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600"><p className="font-semibold text-slate-900">Settings</p><p className="mt-1">Configure alerts, thresholds, and moderation defaults in this section.</p></div>}</CardContent></Card>
        </div>
      </div>
    </section>
  );
}
