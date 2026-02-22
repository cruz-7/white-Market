
import { ChangeEvent, FormEvent, useEffect, useState, useRef } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Check, CheckCheck, CheckCircle2, CircleHelp, Clock3, Eye, EyeOff, GraduationCap, ImagePlus, Info, Lock, MessageCircle, Search, Send, ShoppingCart, ShieldCheck, Star, Store, UserRound, Wallet } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

import Navbar from "./Navbar";
import Footer from "./Footer";
import MobileBottomNav from "./MobileBottomNav";
import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Input } from "./input";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { Textarea } from "./textarea";
import { Badge } from "./badge";
import {
  LocalUser,
  Message,
  Order,
  creditPendingEarnings,
  debitWallet,
  getActivities,
  getConversations,
  getMessages,
  getOrders,
  getProducts,
  getUsers,
  getWallet,
  getWalletTransactions,
  markConversationRead,
  recordActivity,
  releasePendingEarnings,
  saveOrders,
  saveProducts,
  seedData,
  sendMessage,
  setTyping,
  subscribeDataChange,
  timeAgo,
  topUpWallet,
  upsertConversationForProduct,
  upsertUser,
  withdrawWallet,
} from "./data";
import { supabase } from "./supabase-client";
import Index from "./Index";

declare global {
  interface Window {
    PaystackPop?: {
      setup: (config: {
        key: string;
        email: string;
        amount: number;
        currency: string;
        callback: () => void;
      }) => { openIframe: () => void };
    };
  }
}

function readCurrentUser() {
  const raw = localStorage.getItem("wm_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LocalUser;
  } catch {
    return null;
  }
}

function useCurrentUser() {
  const [user, setUser] = useState<LocalUser | null>(readCurrentUser());
  useEffect(() => {
    const sync = () => setUser(readCurrentUser());
    window.addEventListener("wm-auth-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("wm-auth-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return user;
}

function useDataRefresh() {
  const [, setTick] = useState(0);
  useEffect(() => subscribeDataChange(() => setTick((v) => v + 1)), []);
}

function AppScaffold({ children, hideFooter = false, showBack = true }: { children: React.ReactNode; hideFooter?: boolean; showBack?: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const mainPaths = new Set(["/", "/marketplace", "/dashboard", "/orders", "/messages", "/admin", "/auth"]);
  const isSubPage = location.pathname.startsWith("/product/") || location.pathname.startsWith("/checkout/") || location.pathname.startsWith("/profile-setup");
  const shouldShowBack = showBack && (isSubPage || !mainPaths.has(location.pathname));

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#eef7f1,_#f5f5f5_45%)]">
      <Navbar />
      {shouldShowBack && (
        <div className="border-b bg-white/85 shadow-sm backdrop-blur-md">
          <div className="container py-2">
            <button className="inline-flex items-center gap-2 rounded-lg border border-transparent px-2 py-1 text-sm text-slate-500 transition hover:border-slate-200 hover:bg-white hover:text-slate-800" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
          </div>
        </div>
      )}
      <main className="pb-20 md:pb-0">{children}</main>
      {!hideFooter && <Footer />}
      <MobileBottomNav />
    </div>
  );
}

function statDelta(index: number) {
  const deltas = ["+12%", "+7%", "+18%", "+5%", "+9%"];
  return deltas[index % deltas.length];
}

function App() {
  useEffect(() => {
    seedData();
  }, []);

  useEffect(() => {
    if (!supabase) return;

    const syncFromSupabase = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const authUser = sessionData.session?.user;
      if (!authUser) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", authUser.id)
        .maybeSingle();

      const existing = readCurrentUser();
      const syncedUser: LocalUser = {
        id: authUser.id,
        email: authUser.email || existing?.email || "",
        full_name: (profile as any)?.full_name || existing?.full_name || authUser.user_metadata?.full_name || "User",
        role: ((profile as any)?.role as LocalUser["role"]) || existing?.role || "user",
        avatar_url: (authUser.user_metadata?.avatar_url as string | undefined) || existing?.avatar_url,
      };

      localStorage.setItem("wm_user", JSON.stringify(syncedUser));
      upsertUser(syncedUser);
      window.dispatchEvent(new Event("wm-auth-change"));
    };

    syncFromSupabase();
    const { data: sub } = supabase.auth.onAuthStateChange(() => { syncFromSupabase(); });
    return () => { sub.subscription.unsubscribe(); };
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/marketplace" element={<MarketplacePage />} />
      <Route path="/product/:id" element={<ProductDetailPage />} />
      <Route path="/checkout/:orderId" element={<CheckoutPage />} />
      <Route path="/messages" element={<MessagesPage />} />
      <Route path="/orders" element={<OrdersPage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/dashboard" element={<DashboardRouter />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/profile-setup" element={<ProfileSetupPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function AuthPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [tab, setTab] = useState<"login" | "signup">(params.get("tab") === "signup" ? "signup" : "login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"user" | "seller">(params.get("role") === "seller" ? "seller" : "user");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const hasLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const requirementsCount = [hasLength, hasUpper, hasNumber].filter(Boolean).length;
  const strength = requirementsCount <= 1 ? "weak" : requirementsCount === 2 ? "medium" : "strong";
  const allowedDomain = email.endsWith("@st.ug.edu.gh") || email.endsWith("@ug.edu.gh");
  const canSubmitLogin = Boolean(email.trim() && password.trim());
  const canSubmitSignup = Boolean(fullName.trim() && email.trim() && allowedDomain && hasLength && hasUpper && hasNumber && passwordsMatch);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (tab === "login") {
      if (!canSubmitLogin) return;
      const normalizedEmail = email.trim().toLowerCase();

      // Prefer Supabase auth when configured so role is sourced server-side.
      if (supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        if (!error && data.user) {
          const authUser = data.user;
          const { data: profile } = await supabase
            .from("profiles")
            .select("role, full_name")
            .eq("id", authUser.id)
            .maybeSingle();

          const sessionUser: LocalUser = {
            id: authUser.id,
            email: authUser.email || normalizedEmail,
            full_name: (profile as any)?.full_name || authUser.user_metadata?.full_name || normalizedEmail.split("@")[0],
            role: ((profile as any)?.role as LocalUser["role"]) || "user",
            avatar_url: authUser.user_metadata?.avatar_url as string | undefined,
          };

          upsertUser(sessionUser);
          localStorage.setItem("wm_user", JSON.stringify(sessionUser));
          window.dispatchEvent(new Event("wm-auth-change"));
          toast.success("Signed in successfully");
          navigate("/dashboard");
          return;
        }

        toast.error(error?.message || "Login failed. Check your credentials.");
        return;
      }

      // Fallback for local demo mode.
      const existing = getUsers().find((u) => u.email.toLowerCase() === normalizedEmail);
      if (!existing) return toast.error("Account not found. Switch to Sign Up.");
      localStorage.setItem("wm_user", JSON.stringify(existing));
      window.dispatchEvent(new Event("wm-auth-change"));
      toast.success("Signed in successfully");
      navigate("/dashboard");
      return;
    }

    if (!canSubmitSignup) return;
    const normalizedEmail = email.trim().toLowerCase();

    // Prefer Supabase signup for production auth flow.
    if (supabase) {
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: { data: { full_name: fullName.trim() } },
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      if (!data.user) {
        toast.success("Check your email to confirm your account, then log in.");
        setTab("login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", data.user.id)
        .maybeSingle();

      const sessionUser: LocalUser = {
        id: data.user.id,
        full_name: (profile as any)?.full_name || fullName.trim(),
        email: data.user.email || normalizedEmail,
        role: ((profile as any)?.role as LocalUser["role"]) || "user",
      };

      if (role === "seller" && sessionUser.role === "user") {
        toast.info("Account created. Seller mode can be enabled from profile setup.");
      } else {
        toast.success("Account created successfully");
      }

      upsertUser(sessionUser);
      localStorage.setItem("wm_user", JSON.stringify(sessionUser));
      window.dispatchEvent(new Event("wm-auth-change"));
      navigate("/dashboard");
      return;
    }

    // Fallback for local demo mode.
    const user: LocalUser = { id: crypto.randomUUID(), full_name: fullName.trim(), email: normalizedEmail, role };
    upsertUser(user);
    localStorage.setItem("wm_user", JSON.stringify(user));
    window.dispatchEvent(new Event("wm-auth-change"));
    toast.success("Account created successfully");
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#e9f6ef,_#f5f5f5_45%)] py-8 sm:py-12">
      <section className="container max-w-5xl">
        <button className="mb-6 inline-flex items-center gap-2 rounded-lg border border-transparent px-2 py-1 text-sm text-slate-500 transition hover:border-slate-200 hover:bg-white hover:text-slate-700" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4" /> Back to home
        </button>

        <Card className="overflow-hidden border-slate-200 shadow-xl">
          <div className="grid md:grid-cols-[1fr_1.2fr]">
            <div className="hidden bg-primary p-8 text-white md:block">
              <div className="mb-8 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-lg font-bold">WM</div>
                <div>
                  <p className="text-xl font-bold">White Market</p>
                  <p className="text-xs text-white/75">Verified student marketplace</p>
                </div>
              </div>
              <h1 className="text-3xl font-bold leading-tight">Buy, Sell, and Chat with trusted students.</h1>
              <p className="mt-3 text-sm text-white/85">
                One campus platform for safe transactions, wallet payments, and real-time messaging.
              </p>
              <div className="mt-8 space-y-3 text-sm">
                <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> University email verified accounts</p>
                <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Secure wallet checkout and refunds</p>
                <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Buyer protection on eligible orders</p>
              </div>
            </div>

            <CardContent className="p-6 sm:p-8">
              <div className="mb-6 md:hidden">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-sm font-bold text-white">WM</div>
                <h1 className="text-2xl font-bold text-slate-900">Welcome to White Market</h1>
                <p className="text-sm text-slate-500">Sign in to continue or create your campus account.</p>
              </div>

              <div className="mb-6 rounded-xl bg-slate-100 p-1">
                <div className="grid grid-cols-2 gap-1">
                  <button onClick={() => setTab("login")} className={`rounded-lg py-2 text-sm font-semibold transition ${tab === "login" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>Login</button>
                  <button onClick={() => setTab("signup")} className={`rounded-lg py-2 text-sm font-semibold transition ${tab === "signup" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>Sign Up</button>
                </div>
              </div>

              <form onSubmit={onSubmit} className="space-y-4">
                {tab === "signup" && (
                  <>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-900">Account type</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => setRole("user")} className={`rounded-xl border p-3 text-left transition ${role === "user" ? "border-primary bg-primary/5" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                          <GraduationCap className={`mb-1 h-5 w-5 ${role === "user" ? "text-primary" : "text-slate-500"}`} />
                          <p className="text-sm font-semibold text-slate-900">Student</p>
                          <p className="text-xs text-slate-500">Browse and buy</p>
                        </button>
                        <button type="button" onClick={() => setRole("seller")} className={`rounded-xl border p-3 text-left transition ${role === "seller" ? "border-primary bg-primary/5" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                          <Store className={`mb-1 h-5 w-5 ${role === "seller" ? "text-primary" : "text-slate-500"}`} />
                          <p className="text-sm font-semibold text-slate-900">Seller</p>
                          <p className="text-xs text-slate-500">List and earn</p>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-900">Full Name</label>
                      <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ama Mensah" className="h-11 rounded-lg" />
                    </div>
                  </>
                )}

                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-900">{tab === "signup" ? "University Email" : "Email"}</label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@st.ug.edu.gh" className="h-11 rounded-lg" />
                  {tab === "signup" && <p className="mt-1 text-xs text-slate-500">Only @st.ug.edu.gh and @ug.edu.gh emails are accepted.</p>}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-900">Password</label>
                  <div className="relative">
                    <Input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={tab === "signup" ? "Min 8 chars, 1 uppercase, 1 number" : "••••••••"} className="h-11 rounded-lg pr-10" />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" onClick={() => setShowPassword((v) => !v)}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {tab === "signup" && (
                    <div className="mt-2 h-2 rounded-full bg-slate-200">
                      <div className={`h-2 rounded-full transition-all ${strength === "weak" ? "w-1/3 bg-red-500" : strength === "medium" ? "w-2/3 bg-amber-500" : "w-full bg-green-500"}`} />
                    </div>
                  )}
                </div>

                {tab === "signup" && (
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-900">Confirm Password</label>
                    <div className="relative">
                      <Input type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="h-11 rounded-lg pr-10" />
                      <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" onClick={() => setShowConfirmPassword((v) => !v)}>
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {confirmPassword && !passwordsMatch && <p className="mt-1 text-xs text-red-500">Passwords do not match</p>}
                  </div>
                )}

                <Button type="submit" className="h-11 w-full rounded-lg" disabled={tab === "login" ? !canSubmitLogin : !canSubmitSignup}>
                  {tab === "login" ? "Sign In" : "Create Account"}
                </Button>

                <p className="text-center text-xs text-slate-500">
                  By continuing, you agree to White Market Terms and Privacy Policy.
                </p>
              </form>
            </CardContent>
          </div>
        </Card>
      </section>
    </div>
  );
}

function MarketplacePage() {
  useDataRefresh();
  const navigate = useNavigate();
  const user = useCurrentUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("popular");
  const [showVerification, setShowVerification] = useState(false);

  const allProducts = getProducts().filter((p) => p.is_active);
  const categories = ["All", ...Array.from(new Set(allProducts.map((p) => p.category)))];
  const filtered = allProducts.filter((p) => {
    const q = searchQuery.toLowerCase();
    const matchesQuery = p.title.toLowerCase().includes(q) || p.sellerName.toLowerCase().includes(q);
    const matchesCategory = category === "All" || p.category === category;
    return matchesQuery && matchesCategory;
  });

  const products = [...filtered].sort((a, b) => {
    if (sort === "price_asc") return a.price - b.price;
    if (sort === "price_desc") return b.price - a.price;
    if (sort === "newest") return +new Date(b.listed_at) - +new Date(a.listed_at);
    return b.views - a.views;
  });

  const describeProduct = (title: string, categoryName: string) => {
    if (title.toLowerCase().includes("jollof")) return "Freshly prepared campus meal, ready for pickup or quick drop-off.";
    if (title.toLowerCase().includes("calculator")) return "Exam-ready calculator with tested buttons and clean display.";
    if (title.toLowerCase().includes("laptop stand")) return "Adjustable stand to improve posture during study sessions.";
    if (title.toLowerCase().includes("bracelet")) return "Handmade accessories designed for everyday campus style.";
    if (title.toLowerCase().includes("shea")) return "Moisturizing shea blend with a smooth, non-greasy finish.";
    if (title.toLowerCase().includes("tote")) return "Durable tote bag for books, groceries, and daily essentials.";
    return `Popular ${categoryName.toLowerCase()} listing from a campus seller.`;
  };

  const createOrder = (productId: string) => {
    if (!user) return navigate("/auth?role=user");
    const product = allProducts.find((p) => p.id === productId);
    if (!product || product.stock_status === "out_of_stock") return;
    const order: Order = {
      id: `o${Date.now()}`,
      productId: product.id,
      productTitle: product.title,
      productImage: product.image,
      buyerId: user.id,
      buyerName: user.full_name,
      sellerId: product.sellerId,
      sellerName: product.sellerName,
      amount: product.price,
      status: "pending",
      created_at: new Date().toISOString(),
    };
    saveOrders([order, ...getOrders()]);
    toast.success(`${product.title} added to cart`);
    navigate(`/checkout/${order.id}`);
  };

  const messageSeller = (productId: string) => {
    if (!user) return navigate("/auth?role=user");
    const product = allProducts.find((p) => p.id === productId);
    if (!product) return;
    const conv = upsertConversationForProduct({
      productId: product.id,
      productTitle: product.title,
      productImage: product.image,
      buyerId: user.id,
      sellerId: product.sellerId,
      buyerName: user.full_name,
      sellerName: product.sellerName,
    });
    navigate(`/messages?c=${conv.id}&prefill=${encodeURIComponent(`Hi, I'm interested in ${product.title}`)}&back=${encodeURIComponent(`/product/${product.id}`)}`);
  };

  return (
    <AppScaffold>
      <section className="container space-y-6 py-8">
        <div className="rounded-xl border bg-green-50/70 p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="page-title">Marketplace</h1>
              <p className="body-text">Find trusted campus listings with clear pricing, delivery options, and direct seller messaging.</p>
            </div>
            <Button variant="outline" onClick={() => setShowVerification(true)}>
              How Verification Works
            </Button>
          </div>
          <div className="mt-4 rounded-xl border border-green-200 bg-white p-4">
            <div className="flex items-start gap-2 text-slate-800">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Buyer Protection</p>
            </div>
            <div className="mt-3 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
              <p><span className="font-medium text-slate-800">Returns:</span> Request support within 24 hours if the item differs from the listing.</p>
              <p><span className="font-medium text-slate-800">Refunds:</span> Approved cases are refunded to wallet balance after review.</p>
              <p><span className="font-medium text-slate-800">Disputes:</span> Campus support reviews chat, order, and listing evidence fairly.</p>
            </div>
          </div>
        </div>

        <Card>
          <CardContent className="grid gap-3 p-4 md:grid-cols-4">
            <div className="relative md:col-span-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search products or sellers" className="pl-9" />
            </div>
            <select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border bg-white px-3 py-2 text-sm">
              {categories.map((cat) => <option key={cat}>{cat}</option>)}
            </select>
            <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-lg border bg-white px-3 py-2 text-sm">
              <option value="popular">Most Popular</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="newest">Newest</option>
            </select>
            <div className="flex items-center justify-end text-sm text-slate-500">{products.length} listing{products.length === 1 ? "" : "s"}</div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <Card key={p.id} className="overflow-hidden">
              <img src={p.image} alt={p.title} className="h-44 w-full object-cover" />
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="section-title line-clamp-1">{p.title}</h3>
                  <button
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${p.verified_seller ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
                    title={p.verified_seller ? "Verified Student: identity and active student status confirmed." : "Verification pending for this seller."}
                    onClick={() => setShowVerification(true)}
                  >
                    <ShieldCheck className="h-3.5 w-3.5" /> {p.verified_seller ? "Verified" : "Unverified"}
                  </button>
                </div>
                <p className="text-sm text-slate-600 line-clamp-2">{describeProduct(p.title, p.category)}</p>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-800">{p.sellerName}</p>
                  <button className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700" onClick={() => setShowVerification(true)} title="See verification details">
                    <Info className="h-3.5 w-3.5" /> Verified Student
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 text-amber-500" /> {p.rating.toFixed(1)} ({p.reviews})</span>
                  <span>{p.seller_sales} sales</span>
                  <span>Responds {p.response_time}</span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-slate-100 px-2 py-1">{p.delivery_type === "Pickup" ? "Campus Pickup" : p.delivery_type === "Delivery" ? "Same-Day/Next-Day Delivery" : "Campus Pickup or Delivery"}</span>
                  <span className={`rounded-full px-2 py-1 ${p.stock_status === "in_stock" ? "bg-green-100 text-green-700" : p.stock_status === "limited" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                    {p.stock_status === "in_stock" ? "In Stock" : p.stock_status === "limited" ? "Limited" : "Sold Out"}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-1">{p.eta}</span>
                </div>
                <p className="text-xs text-slate-500">Condition: {p.condition === "Used" ? "Used - Good Condition" : p.condition}. {p.condition === "Used" ? "Light wear, tested and fully functional." : "Clean and ready to use."}</p>
                <div className="flex items-center justify-between">
                  <p className="font-bold text-primary">₵ {p.price.toFixed(2)}</p>
                  <p className="text-xs text-slate-500">{p.category}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" variant="outline" onClick={() => messageSeller(p.id)}>Message Seller</Button>
                  <Button size="sm" disabled={p.stock_status === "out_of_stock"} onClick={() => createOrder(p.id)}>Add to Cart</Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" variant="outline" asChild><Link to={`/product/${p.id}`}>View Details</Link></Button>
                  <Button size="sm" disabled={p.stock_status === "out_of_stock"} onClick={() => createOrder(p.id)}>
                    Buy Now
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {products.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-base font-semibold text-slate-800">No products match your filters right now.</p>
              <p className="body-text">Adjust search, category, or sorting to discover more verified campus listings.</p>
              <Button className="mt-3" variant="outline" onClick={() => { setSearchQuery(""); setCategory("All"); setSort("popular"); }}>
                Reset Filters
              </Button>
            </CardContent>
          </Card>
        )}
      </section>

      {showVerification && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <Card className="w-full max-w-lg">
            <CardContent className="p-6">
              <h2 className="section-title">How Verification Works</h2>
              <p className="mt-2 text-sm text-slate-600">
                A Verified Student seller has completed account checks, uploaded a valid student ID, and passed manual review. Verified sellers show stronger trust history and are prioritized in dispute resolution.
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
                <li>Identity and student status confirmed</li>
                <li>Active campus contact details verified</li>
                <li>Monitored for delivery, response, and dispute behavior</li>
              </ul>
              <div className="mt-4 flex justify-end">
                <Button onClick={() => setShowVerification(false)}>Got it</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </AppScaffold>
  );
}
function ProductDetailPage() {
  useDataRefresh();
  const navigate = useNavigate();
  const user = useCurrentUser();
  const { id } = useParams();
  const product = getProducts().find((p) => p.id === id);
  if (!product) return <Navigate to="/marketplace" replace />;

  const createOrder = () => {
    if (!user) return navigate("/auth?role=user");
    const order: Order = {
      id: `o${Date.now()}`,
      productId: product.id,
      productTitle: product.title,
      productImage: product.image,
      buyerId: user.id,
      buyerName: user.full_name,
      sellerId: product.sellerId,
      sellerName: product.sellerName,
      amount: product.price,
      status: "pending",
      created_at: new Date().toISOString(),
    };
    saveOrders([order, ...getOrders()]);
    recordActivity(`${user.full_name} placed order ${order.id}`, "wallet");
    navigate(`/checkout/${order.id}`);
  };

  const openMessage = () => {
    if (!user) return navigate("/auth?role=user");
    const conv = upsertConversationForProduct({
      productId: product.id,
      productTitle: product.title,
      productImage: product.image,
      buyerId: user.id,
      sellerId: product.sellerId,
      buyerName: user.full_name,
      sellerName: product.sellerName,
    });
    navigate(`/messages?c=${conv.id}&prefill=${encodeURIComponent(`Hi, I'm interested in ${product.title}`)}&back=${encodeURIComponent("/marketplace")}`);
  };

  return (
    <AppScaffold>
      <section className="container py-8">
        <div className="mb-4 rounded-xl border bg-white p-5 shadow-sm">
          <h1 className="page-title">Product Details</h1>
          <p className="body-text">Review pricing, seller trust signals, and delivery details before you buy.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <img src={product.image} alt={product.title} className="h-80 w-full rounded-xl object-cover" />
          <Card className="shadow-sm">
            <CardContent className="p-6">
              <h1 className="page-title">{product.title}</h1>
              <p className="mt-2 body-text">Sold by {product.sellerName}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-slate-100 px-2 py-1">{product.delivery_type}</span>
                <span className={`rounded-full px-2 py-1 ${product.stock_status === "in_stock" ? "bg-green-100 text-green-700" : product.stock_status === "limited" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                  {product.stock_status === "in_stock" ? "In Stock" : product.stock_status === "limited" ? "Limited Stock" : "Sold Out"}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-1">{product.condition}</span>
              </div>
              <p className="mt-3 text-3xl font-bold text-primary">GHS {product.price.toFixed(2)}</p>
              <div className="mt-6 flex gap-2">
                <Button className="flex-1" onClick={createOrder}><ShoppingCart className="h-4 w-4" /> Buy Now</Button>
                <Button variant="outline" className="flex-1" onClick={openMessage}><MessageCircle className="h-4 w-4" /> Message Seller</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
      <div className="fixed bottom-16 left-0 right-0 z-40 px-4 md:hidden">
        <Button className="w-full bg-accent hover:bg-orange-600" onClick={openMessage}><MessageCircle className="h-4 w-4" /> Message Seller</Button>
      </div>
    </AppScaffold>
  );
}

function WalletCard({ user, sellerMode }: { user: LocalUser; sellerMode?: boolean }) {
  useDataRefresh();
  const wallet = getWallet(user.id);
  const txs = getWalletTransactions(user.id);
  const [openTopUp, setOpenTopUp] = useState(false);
  const [openWithdraw, setOpenWithdraw] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("paystack");
  const [tab, setTab] = useState<"overview" | "transactions">("overview");

  const handleTopUp = async () => {
    const value = Number(amount);
    if (!value || value <= 0) return;
    const key = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY as string | undefined;
    if (key && method === "paystack") {
      if (!window.PaystackPop) {
        const script = document.createElement("script");
        script.src = "https://js.paystack.co/v1/inline.js";
        script.async = true;
        document.body.appendChild(script);
        await new Promise((resolve) => {
          script.onload = resolve;
          script.onerror = resolve;
        });
      }
      if (window.PaystackPop) {
        window.PaystackPop.setup({
          key,
          email: user.email,
          amount: Math.round(value * 100),
          currency: "GHS",
          callback: () => {
            topUpWallet(user.id, value, "Paystack top up");
            toast.success(`GHS ${value.toFixed(2)} added to your wallet`);
            setOpenTopUp(false);
            setAmount("");
          },
        }).openIframe();
        return;
      }
    }
    topUpWallet(user.id, value, "Simulated wallet top up");
    toast.success(`GHS ${value.toFixed(2)} added to your wallet`);
    setOpenTopUp(false);
    setAmount("");
  };

  const handleWithdraw = () => {
    const value = Number(amount);
    if (!value || value <= 0) return;
    const ok = withdrawWallet(user.id, value, "MoMo withdrawal request");
    if (!ok) return toast.error("Insufficient wallet balance");
    toast.success("Withdrawal request submitted");
    setOpenWithdraw(false);
    setAmount("");
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="label-text">My Wallet</p>
            <p className="text-3xl font-bold">GHS {wallet.balance.toFixed(2)}</p>
            <p className="body-text">{sellerMode ? "Available Balance" : "Available to spend"}</p>
            {sellerMode && <p className="text-sm text-amber-600">Pending Earnings: GHS {wallet.pending_earnings.toFixed(2)}</p>}
          </div>
          <Wallet className="h-9 w-9 text-primary" />
        </div>

        <div className="mb-4 flex gap-2">
          <Button onClick={() => setOpenTopUp(true)}>Top Up</Button>
          <Button variant="outline" onClick={() => setOpenWithdraw(true)}>Withdraw</Button>
          {sellerMode && wallet.pending_earnings > 0 && <Button variant="outline" onClick={() => releasePendingEarnings(user.id)}>Release Pending</Button>}
        </div>

        {!sellerMode && wallet.balance <= 0 && (
          <div className="mb-4 rounded-xl border border-dashed border-accent/40 bg-accent/5 p-3">
            <p className="text-sm font-medium text-slate-800">Your wallet is empty. Add funds to check out faster.</p>
            <p className="text-xs text-slate-500">First top-up bonus: get free priority delivery on your next order.</p>
            <Button size="sm" className="mt-2" onClick={() => setOpenTopUp(true)}>Top Up Now</Button>
          </div>
        )}

        <div className="mb-3 flex gap-2">
          <Button size="sm" variant={tab === "overview" ? "default" : "outline"} onClick={() => setTab("overview")}>Overview</Button>
          <Button size="sm" variant={tab === "transactions" ? "default" : "outline"} onClick={() => setTab("transactions")}>Transactions</Button>
        </div>

        {tab === "transactions" ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-gray-500"><th className="py-2">Date</th><th>Type</th><th>Description</th><th>Amount</th><th>Balance After</th></tr></thead>
              <tbody>
                {txs.slice(0, 8).map((t) => (
                  <tr key={t.id} className="border-t"><td className="py-2">{new Date(t.created_at).toLocaleDateString()}</td><td>{t.type}</td><td>{t.description}</td><td>GHS {t.amount.toFixed(2)}</td><td>GHS {t.balance_after.toFixed(2)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="body-text">Track funds, top up with Paystack, and withdraw to mobile money.</p>}
      </CardContent>

      {(openTopUp || openWithdraw) && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <Card className="w-full max-w-md">
            <CardContent className="p-5">
              <h3 className="section-title">{openTopUp ? "Top Up Wallet" : "Withdraw Funds"}</h3>
              <div className="mt-3 space-y-3">
                <div><p className="label-text">Amount (GHS)</p><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
                {openTopUp && <div><p className="label-text">Payment Method</p><select className="w-full rounded-lg border bg-white p-2 text-sm" value={method} onChange={(e) => setMethod(e.target.value)}><option value="paystack">Paystack (Card/MoMo)</option><option value="momo">Mobile Money</option></select></div>}
              </div>
              <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => { setOpenTopUp(false); setOpenWithdraw(false); }}>Cancel</Button><Button onClick={openTopUp ? handleTopUp : handleWithdraw}>{openTopUp ? "Confirm Top Up" : "Request Withdrawal"}</Button></div>
            </CardContent>
          </Card>
        </div>
      )}
    </Card>
  );
}

function DashboardRouter() {
  const user = useCurrentUser();
  if (!user) return <Navigate to="/auth" replace />;
  if (user.role === "admin") return <Navigate to="/admin" replace />;
  return user.role === "seller" ? <SellerDashboard /> : <StudentDashboard />;
}
function SellerDashboard() {
  useDataRefresh();
  const navigate = useNavigate();
  const user = useCurrentUser();
  const [range, setRange] = useState<"7" | "30" | "all">("7");
  if (!user) return <Navigate to="/auth" replace />;
  const products = getProducts().filter((p) => p.sellerId === user.id || user.id === "u_seller_1");
  const orders = getOrders().filter((o) => o.sellerId === user.id || user.id === "u_seller_1");
  const revenueAll = orders.filter((o) => o.status === "completed").reduce((s, o) => s + o.amount, 0);
  const monthRevenue = orders.filter((o) => Date.now() - +new Date(o.created_at) < 30 * 86400000).reduce((s, o) => s + o.amount, 0);
  const pendingCount = orders.filter((o) => ["pending", "confirmed"].includes(o.status)).length;
  const chartDays = range === "7" ? 7 : range === "30" ? 30 : 60;
  const chartData = Array.from({ length: chartDays }, (_, i) => {
    const date = new Date(Date.now() - (chartDays - i - 1) * 86400000);
    const key = date.toISOString().slice(0, 10);
    return { day: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }), revenue: orders.filter((o) => o.created_at.startsWith(key)).reduce((s, o) => s + o.amount, 0) };
  });

  const addNewProduct = () => {
    const newProduct = {
      id: `p${Date.now()}`,
      title: "New Campus Listing",
      price: 40,
      sellerId: user.id,
      sellerName: user.full_name,
      category: "Accessories",
      image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&q=80",
      is_active: true,
      stock_status: "in_stock" as const,
      views: 0,
      rating: 5,
      reviews: 0,
      eta: "Same day",
      delivery_type: "Pickup or Delivery" as const,
      condition: "New" as const,
      verified_seller: true,
      seller_sales: 0,
      response_time: "~10 min",
      listed_at: new Date().toISOString(),
    };
    saveProducts([newProduct, ...getProducts()]);
    toast.success("New product draft created");
  };

  const toggleProductVisibility = (productId: string) => {
    saveProducts(getProducts().map((p) => (p.id === productId ? { ...p, is_active: !p.is_active } : p)));
    toast.success("Listing visibility updated");
  };

  const deleteProduct = (productId: string) => {
    saveProducts(getProducts().filter((p) => p.id !== productId));
    toast.success("Product deleted");
  };

  const openWithdrawFromWallet = () => {
    document.getElementById("wallet-card")?.scrollIntoView({ behavior: "smooth", block: "center" });
    toast.info("Use the Withdraw button on the wallet card.");
  };

  const shareStoreLink = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/marketplace?seller=${user.id}`);
    toast.success("Store link copied");
  };

  return (
    <AppScaffold>
      <section className="container space-y-6 py-8">
        <div className="rounded-xl border bg-white p-5 shadow-sm"><h1 className="page-title">Welcome back, {user.full_name.split(" ")[0]} 👋</h1><p className="body-text">Manage your store, orders, and payouts with a clear business view.</p></div>
        <div id="wallet-card"><WalletCard user={user} sellerMode /></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[["Total Sales", `GHS ${revenueAll.toFixed(2)}`], ["This Month", `GHS ${monthRevenue.toFixed(2)}`], ["Active Listings", String(products.filter((p) => p.is_active).length)], ["Total Orders", String(orders.length)], ["Pending Orders", String(pendingCount)]].map(([label, value], i) => (
            <Card key={label}><CardContent className="p-4"><p className="label-text">{label}</p><p className={`mt-1 text-2xl font-bold ${label === "Pending Orders" && pendingCount > 0 ? "text-amber-500" : "text-primary"}`}>{value}</p><p className="text-xs text-gray-500">{statDelta(i)} vs last period</p></CardContent></Card>
          ))}
        </div>

        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="mb-4 flex items-center justify-between"><h2 className="section-title">Sales Performance</h2><div className="flex gap-2"><Button size="sm" variant={range === "7" ? "default" : "outline"} onClick={() => setRange("7")}>7 days</Button><Button size="sm" variant={range === "30" ? "default" : "outline"} onClick={() => setRange("30")}>30 days</Button><Button size="sm" variant={range === "all" ? "default" : "outline"} onClick={() => setRange("all")}>All time</Button></div></div>
            <div className="h-64"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id="sellRev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#006633" stopOpacity={0.35} /><stop offset="95%" stopColor="#006633" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" hide={chartDays > 30} /><YAxis /><Tooltip /><Area dataKey="revenue" stroke="#006633" fill="url(#sellRev)" /></AreaChart></ResponsiveContainer></div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-6">
            <h2 className="section-title mb-3">My Products</h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              <button onClick={addNewProduct} className="text-left"><Card className="border-dashed"><CardContent className="p-4 text-center"><p className="text-sm font-semibold">+ List a Product</p></CardContent></Card></button>
              {products.map((p) => (
                <Card key={p.id}>
                  <img src={p.image} className="h-24 w-full rounded-t-xl object-cover" />
                  <CardContent className="p-3">
                    <p className="line-clamp-1 text-sm font-semibold">{p.title}</p>
                    <p className="text-xs text-gray-500">{p.stock_status === "in_stock" ? "In Stock" : p.stock_status === "limited" ? "Limited" : "Out of Stock"} • {p.views} views</p>
                    <p className="font-bold text-primary">GHS {p.price}</p>
                    <div className="mt-2 flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => navigate(`/product/${p.id}`)}>Edit</Button>
                      <Button size="sm" variant="outline" onClick={() => toggleProductVisibility(p.id)}>{p.is_active ? "Hide" : "Show"}</Button>
                      <Button size="sm" variant="destructive" onClick={() => deleteProduct(p.id)}>Delete</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-6">
            <h2 className="section-title mb-3">Recent Orders</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead><tr className="text-left text-xs uppercase tracking-wide text-gray-500"><th className="py-2">Order ID</th><th>Product</th><th>Buyer Name</th><th>Amount</th><th>Status</th><th>Date</th><th>Action</th></tr></thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="border-t"><td className="py-2">#{o.id}</td><td>{o.productTitle}</td><td>{o.buyerName}</td><td>GHS {o.amount}</td><td><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize">{o.status}</span></td><td>{new Date(o.created_at).toLocaleDateString()}</td><td><Button size="sm" variant="outline" onClick={() => navigate(`/checkout/${o.id}`)}>Open</Button></td></tr>
                ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-6">
            <h2 className="section-title mb-3">Quick Actions</h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <Button onClick={addNewProduct}>Add New Product</Button>
              <Button variant="outline" onClick={() => navigate(`/marketplace?seller=${user.id}`)}>View My Store</Button>
              <Button variant="outline" onClick={openWithdrawFromWallet}>Withdraw Funds</Button>
              <Button variant="outline" onClick={() => navigate('/profile-setup')}>Edit Business Profile</Button>
              <Button variant="outline" onClick={shareStoreLink}>Share Store Link</Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </AppScaffold>
  );
}
function EmptyStateCard({ title, description, cta, to }: { title: string; description: string; cta: string; to: string }) {
  return (
    <div className="rounded-xl border border-dashed bg-slate-50 p-6 text-center">
      <p className="text-base font-semibold text-slate-800">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{description}</p>
      <Button className="mt-3" asChild><Link to={to}>{cta}</Link></Button>
    </div>
  );
}

function ProductDiscoveryCard({ product, onQuickAdd }: { product: ReturnType<typeof getProducts>[number]; onQuickAdd: (id: string) => void }) {
  return (
    <Card className="overflow-hidden">
      <img src={product.image} className="h-32 w-full object-cover" />
      <CardContent className="space-y-1 p-3">
        <p className="line-clamp-1 text-sm font-semibold">{product.title}</p>
        <p className="text-xs text-slate-500">by {product.sellerName}</p>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 text-amber-500" /> {product.rating.toFixed(1)}</span>
          <span>({product.reviews} reviews)</span>
          <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> {product.eta}</span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <p className="font-bold text-primary">GHS {product.price.toFixed(2)}</p>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" asChild><Link to={`/product/${product.id}`}>View</Link></Button>
            <Button size="sm" onClick={() => onQuickAdd(product.id)}><ShoppingCart className="h-3.5 w-3.5" /> Add</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StudentDashboard() {
  useDataRefresh();
  const user = useCurrentUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [wishlist, setWishlist] = useState<string[]>(["p2", "p5"]);
  if (!user) return <Navigate to="/auth" replace />;

  const allProducts = getProducts().filter((p) => p.is_active);
  const orders = getOrders().filter((o) => o.buyerId === user.id || user.id === "u_student_1");
  const activeOrders = orders.filter((o) => ["pending", "confirmed", "shipped", "delivered"].includes(o.status));
  const history = orders.filter((o) => o.status === "completed");
  const wallet = getWallet(user.id);
  const categories = ["All", ...Array.from(new Set(allProducts.map((p) => p.category)))];

  const searched = allProducts.filter((p) => {
    const q = searchQuery.toLowerCase();
    const matchesText = p.title.toLowerCase().includes(q) || p.sellerName.toLowerCase().includes(q);
    const matchesCategory = activeCategory === "All" || p.category === activeCategory;
    return matchesText && matchesCategory;
  });

  const recentlyViewed = searched.sort((a, b) => b.views - a.views).slice(0, 4);
  const savedItems = searched.filter((p) => wishlist.includes(p.id));
  const seenSellers = new Set([...recentlyViewed, ...savedItems].map((p) => p.sellerId));
  const recommendations = searched.filter((p) => !wishlist.includes(p.id) && !recentlyViewed.some((rv) => rv.id === p.id) && !seenSellers.has(p.sellerId)).slice(0, 4);
  const hasAnyData = orders.length > 0 || wishlist.length > 0;

  const onQuickAdd = (productId: string) => {
    const product = allProducts.find((p) => p.id === productId);
    if (!product) return;
    const order: Order = {
      id: `o${Date.now()}`,
      productId: product.id,
      productTitle: product.title,
      productImage: product.image,
      buyerId: user.id,
      buyerName: user.full_name,
      sellerId: product.sellerId,
      sellerName: product.sellerName,
      amount: product.price,
      status: "pending",
      created_at: new Date().toISOString(),
    };
    saveOrders([order, ...getOrders()]);
    toast.success(`${product.title} added to your active orders`);
  };

  return (
    <AppScaffold>
      <section className="container space-y-6 py-8">
        <div>
          <h1 className="page-title">Hey {user.full_name.split(" ")[0]} 👋 What do you need today?</h1>
          <p className="body-text">Discover trusted campus sellers, track orders, and pay faster with your wallet.</p>
        </div>

        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search products, sellers, or categories" className="pl-9" />
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button key={cat} onClick={() => setActiveCategory(cat)} className={`rounded-full border px-3 py-1 text-xs ${activeCategory === cat ? "border-primary bg-primary text-white" : "border-slate-200 bg-white text-slate-600"}`}>
                  {cat}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <WalletCard user={user} />

        {!hasAnyData ? (
          <Card>
            <CardContent className="p-6">
              <h2 className="section-title mb-3">Get Started in 3 Steps</h2>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border p-4"><p className="label-text">Step 1</p><p className="font-semibold">Fund your wallet</p><p className="body-text">Top up once and check out in seconds.</p></div>
                <div className="rounded-xl border p-4"><p className="label-text">Step 2</p><p className="font-semibold">Save products</p><p className="body-text">Build your wishlist for quick access.</p></div>
                <div className="rounded-xl border p-4"><p className="label-text">Step 3</p><p className="font-semibold">Place your first order</p><p className="body-text">Track delivery and review your seller.</p></div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Total Orders", String(orders.length)],
              ["Pending Deliveries", String(activeOrders.length)],
              ["Completed Orders", String(history.length)],
              ["Saved Items", String(wishlist.length)],
            ].map(([label, value]) => (
              <Card key={label}><CardContent className="p-4"><p className="label-text">{label}</p><p className="mt-1 text-2xl font-bold text-primary">{value}</p></CardContent></Card>
            ))}
          </div>
        )}

        <Card>
          <CardContent className="p-6">
            <h2 className="section-title mb-3">Pick Up Where You Left Off</h2>
            {recentlyViewed.length === 0 ? (
              <EmptyStateCard
                title="No recent browsing activity yet"
                description="Start exploring categories and we'll remember what matters to you."
                cta="Browse Marketplace"
                to="/marketplace"
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {recentlyViewed.map((p) => <ProductDiscoveryCard key={p.id} product={p} onQuickAdd={onQuickAdd} />)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h2 className="section-title mb-3">My Active Orders</h2>
            {activeOrders.length === 0 ? (
              <EmptyStateCard
                title="You don't have any active orders yet"
                description="When you place an order, delivery updates and ETA will appear here."
                cta="Start Shopping"
                to="/marketplace"
              />
            ) : (
              <div className="space-y-2">
                {activeOrders.map((o) => (
                  <Card key={o.id}>
                    <CardContent className="flex items-center justify-between gap-3 p-4">
                      <div>
                        <p className="font-semibold">{o.productTitle}</p>
                        <p className="body-text">{o.sellerName} • GHS {o.amount}</p>
                      </div>
                      <Button size="sm" asChild><Link to={`/checkout/${o.id}`}>Track Order</Link></Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h2 className="section-title mb-3">Saved Items</h2>
            {savedItems.length === 0 ? (
              <EmptyStateCard
                title="Your saved list is empty"
                description="Save products you like so you can compare and buy later."
                cta="Find Products to Save"
                to="/marketplace"
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {savedItems.map((p) => (
                  <ProductDiscoveryCard key={p.id} product={p} onQuickAdd={onQuickAdd} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h2 className="section-title mb-3">Recommended for You</h2>
            {recommendations.length === 0 ? (
              <EmptyStateCard
                title="We need a little more activity to personalize recommendations"
                description="Browse products or save a few items and we'll suggest sellers that match your interests."
                cta="Discover More Products"
                to="/marketplace"
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {recommendations.map((p) => <ProductDiscoveryCard key={p.id} product={p} onQuickAdd={onQuickAdd} />)}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </AppScaffold>
  );
}

function AdminDashboard() {
  useDataRefresh();
  const navigate = useNavigate();
  const user = useCurrentUser();
  const [tab, setTab] = useState<"users" | "products" | "orders" | "disputes">("users");
  if (!user) return <Navigate to="/auth" replace />;
  const users = getUsers();
  const products = getProducts();
  const orders = getOrders();
  const activities = getActivities();
  const gmv = orders.reduce((s, o) => s + o.amount, 0);
  const dailyOrders = Array.from({ length: 30 }, (_, i) => { const date = new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10); return { day: date.slice(5), orders: orders.filter((o) => o.created_at.startsWith(date)).length }; });
  const categorySales = Object.entries(products.reduce<Record<string, number>>((acc, p) => { const sold = orders.filter((o) => o.productId === p.id && o.status === "completed").reduce((s, o) => s + o.amount, 0); acc[p.category] = (acc[p.category] || 0) + sold; return acc; }, {})).map(([category, sales]) => ({ category, sales })).sort((a, b) => b.sales - a.sales).slice(0, 5);

  const resolveDispute = (orderId: string) => {
    saveOrders(getOrders().map((o) => (o.id === orderId ? { ...o, status: "confirmed" as const } : o)));
    toast.success(`Dispute on order #${orderId} marked resolved`);
  };

  return (
    <AppScaffold>
      <section className="container space-y-6 py-8">
        <div className="rounded-xl border bg-white p-5 shadow-sm"><h1 className="page-title">Admin Dashboard</h1><p className="body-text">Monitor marketplace health, compliance, and operations from one control center.</p></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["Total Users", users.length, "+6%"], ["Products Listed", products.length, "+9%"], ["Total Orders", orders.length, "+11%"], ["Platform Revenue / GMV", `GHS ${gmv.toFixed(2)}`, "+14%"]].map(([title, value, growth]) => (<Card key={String(title)} className="shadow-sm"><CardContent className="p-4"><p className="label-text">{String(title)}</p><p className="mt-1 text-2xl font-bold text-primary">{String(value)}</p><p className="text-xs text-green-600">{String(growth)} vs last week</p></CardContent></Card>))}</div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card><CardContent className="p-4"><h2 className="section-title mb-2">Recent Activity Feed</h2><div className="space-y-2">{activities.slice(0, 10).map((a: any) => (<div key={a.id} className="rounded-lg border p-2"><p className="text-sm">{a.text}</p><p className="text-xs text-gray-500">{timeAgo(a.time)}</p></div>))}</div></CardContent></Card>
          <Card><CardContent className="space-y-4 p-4"><h2 className="section-title">Charts & Analytics</h2><div className="h-40"><ResponsiveContainer width="100%" height="100%"><LineChart data={dailyOrders}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" hide /><YAxis /><Tooltip /><Line dataKey="orders" stroke="#006633" strokeWidth={2} /></LineChart></ResponsiveContainer></div><div className="h-40"><ResponsiveContainer width="100%" height="100%"><BarChart data={categorySales}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="category" /><YAxis /><Tooltip /><Bar dataKey="sales" fill="#FF6B00" /></BarChart></ResponsiveContainer></div></CardContent></Card>
          <Card><CardContent className="p-4"><h2 className="section-title mb-2">Pending Actions</h2><div className="space-y-2">{[["Sellers awaiting verification", 3, "Review", "users"], ["Open disputes", orders.filter((o) => o.status === "disputed").length, "Resolve", "disputes"], ["Reported products", 2, "Review", "products"], ["Flagged users", 1, "Review", "users"]].map(([label, count, cta, toTab]) => (<div key={String(label)} className="flex items-center justify-between rounded-lg border p-2"><div><p className="text-sm">{String(label)}</p><p className="text-xs text-gray-500">{String(count)} pending</p></div><Button size="sm" variant="outline" onClick={() => setTab(String(toTab) as any)}>{String(cta)}</Button></div>))}</div></CardContent></Card>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="mb-3 flex gap-2">
              <Button size="sm" variant={tab === "users" ? "default" : "outline"} onClick={() => setTab("users")}>Users</Button>
              <Button size="sm" variant={tab === "products" ? "default" : "outline"} onClick={() => setTab("products")}>Products</Button>
              <Button size="sm" variant={tab === "orders" ? "default" : "outline"} onClick={() => setTab("orders")}>Orders</Button>
              <Button size="sm" variant={tab === "disputes" ? "default" : "outline"} onClick={() => setTab("disputes")}>Disputes</Button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  {tab === "users" && <tr className="text-left text-gray-500"><th className="py-2">Name</th><th>Email</th><th>Role</th><th>Verified</th><th>Joined</th><th>Actions</th></tr>}
                  {tab === "products" && <tr className="text-left text-gray-500"><th className="py-2">Image</th><th>Title</th><th>Seller</th><th>Price</th><th>Status</th><th>Actions</th></tr>}
                  {tab === "orders" && <tr className="text-left text-gray-500"><th className="py-2">Order ID</th><th>Buyer</th><th>Seller</th><th>Amount</th><th>Status</th><th>Actions</th></tr>}
                  {tab === "disputes" && <tr className="text-left text-gray-500"><th className="py-2">Order ID</th><th>Raised By</th><th>Reason</th><th>Status</th><th>Resolve</th></tr>}
                </thead>
                <tbody>
                  {tab === "users" && getUsers().map((u) => <tr key={u.id} className="border-t"><td className="py-2">{u.full_name}</td><td>{u.email}</td><td>{u.role}</td><td>{u.role === "seller" ? "Yes" : "-"}</td><td>{new Date().toLocaleDateString()}</td><td><Button size="sm" variant="outline" onClick={() => navigate("/profile-setup")}>Manage</Button></td></tr>)}
                  {tab === "products" && products.map((p) => <tr key={p.id} className="border-t"><td className="py-2"><img src={p.image} className="h-8 w-8 rounded" /></td><td>{p.title}</td><td>{p.sellerName}</td><td>GHS {p.price}</td><td>{p.is_active ? "active" : "hidden"}</td><td><Button size="sm" variant="outline" onClick={() => navigate(`/product/${p.id}`)}>Review</Button></td></tr>)}
                  {tab === "orders" && orders.map((o) => <tr key={o.id} className="border-t"><td className="py-2">#{o.id}</td><td>{o.buyerName}</td><td>{o.sellerName}</td><td>GHS {o.amount}</td><td>{o.status}</td><td><Button size="sm" variant="outline" onClick={() => navigate(`/checkout/${o.id}`)}>Open</Button></td></tr>)}
                  {tab === "disputes" && orders.filter((o) => o.status === "disputed").map((o) => <tr key={o.id} className="border-t"><td className="py-2">#{o.id}</td><td>{o.buyerName}</td><td>Product mismatch</td><td>{o.status}</td><td><Button size="sm" onClick={() => resolveDispute(o.id)}>Resolve</Button></td></tr>)}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>
    </AppScaffold>
  );
}

function OrdersPage() {
  useDataRefresh();
  const user = useCurrentUser();
  if (!user) return <Navigate to="/auth" replace />;
  const orders = getOrders().filter((o) => o.buyerId === user.id || o.sellerId === user.id || user.role === "admin");
  return (
    <AppScaffold>
      <section className="container py-8">
        <div className="mb-4 rounded-xl border bg-white p-5 shadow-sm">
          <h1 className="page-title">Orders</h1>
          <p className="body-text">Track every order status, payment state, and next action in one place.</p>
        </div>
        <div className="space-y-3">
          {orders.map((o) => (
            <Card key={o.id} className="shadow-sm">
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-semibold">{o.productTitle}</p>
                  <p className="body-text">#{o.id} • {o.status}</p>
                </div>
                <Button asChild size="sm">
                  <Link to={`/checkout/${o.id}`}>Open</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </AppScaffold>
  );
}
function CheckoutPage() {
  useDataRefresh();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const { orderId } = useParams();
  if (!user) return <Navigate to="/auth" replace />;
  const order = getOrders().find((o) => o.id === orderId);
  if (!order) return <Navigate to="/orders" replace />;
  const wallet = getWallet(user.id);
  const shortfall = Math.max(0, order.amount - wallet.balance);

  const payNow = () => {
    const ok = debitWallet(user.id, order.amount, `Order payment #${order.id}`, order.id);
    if (!ok) return toast.error(`Insufficient balance. Shortfall: GHS ${shortfall.toFixed(2)}`);
    saveOrders(getOrders().map((o) => (o.id === order.id ? { ...o, status: "confirmed" as const } : o)));
    creditPendingEarnings(order.sellerId, order.amount, order.id);
    recordActivity(`Order #${order.id} paid via wallet`, "wallet");
    toast.success("Order paid with wallet successfully");
    navigate("/orders");
  };

  return (
    <AppScaffold>
      <section className="container py-8">
        <div className="mb-4 rounded-xl border bg-white p-5 shadow-sm">
          <h1 className="page-title">Checkout</h1>
          <p className="body-text">Confirm payment securely with wallet balance and transparent order totals.</p>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Card className="shadow-sm"><CardContent className="p-6"><p className="label-text">Order Summary</p><p className="section-title">{order.productTitle}</p><p className="mt-3 text-2xl font-bold text-primary">GHS {order.amount.toFixed(2)}</p><p className="mt-2 text-sm text-slate-500">Seller: {order.sellerName}</p></CardContent></Card>
          <Card className="shadow-sm"><CardContent className="p-6"><p className="label-text">Wallet Balance</p><p className="text-2xl font-bold">GHS {wallet.balance.toFixed(2)}</p>{wallet.balance >= order.amount ? <Button className="mt-4 w-full" onClick={payNow}>Pay with Wallet</Button> : <><p className="mt-3 text-sm text-red-500">Shortfall: GHS {shortfall.toFixed(2)}</p><Button className="mt-3 w-full" onClick={() => topUpWallet(user.id, shortfall + 10, "Top up from checkout")}>Top Up to Continue</Button></>}</CardContent></Card>
        </div>
      </section>
    </AppScaffold>
  );
}

function MessageStatusIcon({ status }: { status: Message["status"] }) {
  if (status === "sent") return <Check className="h-3 w-3" />;
  if (status === "delivered") return <CheckCheck className="h-3 w-3" />;
  return <CheckCheck className="h-3 w-3 text-green-500" />;
}

function MessagesPage() {
  useDataRefresh();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("c") || "";
  const prefill = params.get("prefill") || "";
  const backPath = params.get("back");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState(prefill);
  const [uploadingImage, setUploadingImage] = useState<string | undefined>(undefined);
  const conversations = getConversations().filter((c) => c.buyerId === user?.id || c.sellerId === user?.id);
  const messages = getMessages();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isMobile = typeof window !== "undefined" ? window.innerWidth < 768 : false;

  useEffect(() => { if (prefill) setDraft(prefill); }, [prefill]);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [selectedId, messages.length]);
  useEffect(() => { if (selectedId && user) markConversationRead(selectedId, user.id); }, [selectedId, user]);
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase.channel("wm-messages").on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
      window.dispatchEvent(new Event("wm-data-change"));
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  if (!user) return <Navigate to="/auth" replace />;

  const filtered = conversations.filter((c) => {
    const person = c.buyerId === user.id ? c.sellerName : c.buyerName;
    return person.toLowerCase().includes(search.toLowerCase()) || c.productTitle.toLowerCase().includes(search.toLowerCase());
  }).sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at));

  const selected = filtered.find((c) => c.id === selectedId) || filtered[0];
  const conversationMessages = selected ? messages.filter((m) => m.conversationId === selected.id) : [];

  const onSend = () => {
    if (!selected || (!draft.trim() && !uploadingImage)) return;
    sendMessage({ conversationId: selected.id, senderId: user.id, text: draft.trim(), imageUrl: uploadingImage });
    setDraft("");
    setUploadingImage(undefined);
  };

  const onDraftChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    if (!selected) return;
    setDraft(e.target.value);
    setTyping(selected.id, user.id, true);
    window.clearTimeout((onDraftChange as any).typingTimer);
    (onDraftChange as any).typingTimer = window.setTimeout(() => setTyping(selected.id, user.id, false), 800);
  };

  const onImagePick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setUploadingImage(String(reader.result));
    reader.readAsDataURL(file);
  };

  return (
    <AppScaffold hideFooter>
      <section className="container py-6">
        <div className="mb-4 rounded-xl border bg-white p-4 shadow-sm">
          <h1 className="page-title">Messages</h1>
          <p className="body-text">Chat with buyers and sellers in real time to finalize product details quickly.</p>
        </div>
        {backPath && (
          <div className="mb-3">
            <button className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800" onClick={() => navigate(backPath)}>
              <ArrowLeft className="h-4 w-4" /> Back to previous page
            </button>
          </div>
        )}
        <div className="overflow-hidden rounded-xl border bg-white shadow-md md:grid md:h-[76vh] md:grid-cols-[360px_1fr]">
          {(!isMobile || !selectedId) && (
            <div className="border-r">
              <div className="p-3"><div className="relative"><Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><Input className="pl-8" placeholder="Search name or product" value={search} onChange={(e) => setSearch(e.target.value)} /></div></div>
              <div className="max-h-[68vh] overflow-y-auto">{filtered.map((c) => { const partnerName = c.buyerId === user.id ? c.sellerName : c.buyerName; const last = messages.filter((m) => m.conversationId === c.id).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))[0]; const unread = messages.filter((m) => m.conversationId === c.id && m.senderId !== user.id && m.status !== "read").length; return (<button key={c.id} className="flex w-full items-center gap-3 border-b p-3 text-left hover:bg-gray-50" onClick={() => setParams({ c: c.id })}><Avatar className="h-10 w-10"><AvatarFallback><UserRound className="h-4 w-4" /></AvatarFallback></Avatar><img src={c.productImage} alt={c.productTitle} className="h-10 w-10 rounded-lg object-cover" /><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="truncate font-semibold">{partnerName}</p><span className="text-xs text-gray-400">{last ? timeAgo(last.created_at) : ""}</span></div><p className="truncate text-xs text-gray-500">{last?.text || (last?.imageUrl ? "Image" : "No messages yet")}</p></div>{unread > 0 && <span className="rounded-full bg-green-600 px-2 py-0.5 text-xs text-white">{unread}</span>}</button>); })}</div>
            </div>
          )}

          {selected && (!isMobile || selectedId) ? (
            <div className="flex h-[76vh] flex-col">
              <div className="flex items-center justify-between border-b p-3"><div className="flex items-center gap-2">{isMobile && <button onClick={() => setParams({})}><ArrowLeft className="h-4 w-4" /></button>}<Avatar className="h-8 w-8"><AvatarFallback>{(selected.buyerId === user.id ? selected.sellerName : selected.buyerName).slice(0, 1)}</AvatarFallback></Avatar><div><p className="text-sm font-semibold">{selected.buyerId === user.id ? selected.sellerName : selected.buyerName}</p><div className="flex items-center gap-1 text-xs text-gray-500"><img src={selected.productImage} className="h-4 w-4 rounded object-cover" /><span className="truncate">{selected.productTitle}</span></div></div></div><Info className="h-4 w-4 text-gray-500" /></div>
              <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto bg-gray-50 p-3">{conversationMessages.map((m) => { const mine = m.senderId === user.id; return (<div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}><div className={`max-w-[75%] rounded-2xl px-3 py-2 ${mine ? "bg-primary text-white" : "bg-gray-200 text-gray-900"}`}>{m.imageUrl && <img src={m.imageUrl} className="mb-2 max-h-48 rounded-lg" />}{m.text && <p className="text-sm">{m.text}</p>}<div className={`mt-1 flex items-center gap-1 text-[10px] ${mine ? "text-green-100" : "text-gray-500"}`}><span>{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>{mine && <MessageStatusIcon status={m.status} />}</div></div></div>); })}{selected.typingBy && selected.typingBy !== user.id && <p className="text-xs text-gray-500">typing...</p>}</div>
              <div className="border-t p-3">{uploadingImage && <div className="mb-2 inline-flex items-center gap-2 rounded-lg border bg-white px-2 py-1 text-xs"><img src={uploadingImage} className="h-8 w-8 rounded object-cover" /><span>Image attached</span></div>}<div className="flex items-end gap-2"><label className="cursor-pointer rounded-lg border p-2"><ImagePlus className="h-4 w-4" /><input type="file" accept="image/*" className="hidden" onChange={onImagePick} /></label><Textarea value={draft} onChange={onDraftChange} rows={1} placeholder="Type a message" className="min-h-10 resize-none" /><Button onClick={onSend} disabled={!draft.trim() && !uploadingImage}><Send className="h-4 w-4" /></Button></div></div>
            </div>
          ) : <div className="grid h-[76vh] place-items-center text-gray-500">Select a conversation</div>}
        </div>
      </section>
    </AppScaffold>
  );
}

type SetupRole = "buyer" | "seller" | "both";

const SETUP_CAMPUSES = ["Legon Main", "UG Business School", "Korle-Bu", "City Campus", "Distance Learning"];
const SETUP_CATEGORIES = ["Food", "Electronics", "Accessories", "Beauty", "Books", "Fashion", "Services"];

function ProfileSetupPage() {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [attempted, setAttempted] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [form, setForm] = useState({
    role: "buyer" as SetupRole,
    fullName: "",
    studentId: "",
    campus: "",
    whatsapp: "",
    interestedCategories: [] as string[],
    buyerBudget: "",
    buyerNotifications: true,
    sellerCategories: [] as string[],
    sellerFulfillment: [] as string[],
    momoNumber: "",
    paystackId: "",
    avatarUrl: "",
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!user) return;
    const key = `wm-profile-setup-draft-${user.id}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const draft = JSON.parse(raw) as typeof form;
        setForm((prev) => ({ ...prev, ...draft, fullName: draft.fullName || user.full_name, avatarUrl: draft.avatarUrl || user.avatar_url || "" }));
        return;
      } catch {
        // no-op
      }
    }
    setForm((prev) => ({ ...prev, fullName: user.full_name, avatarUrl: user.avatar_url || "" }));
  }, [user]);

  if (!user) return <Navigate to="/auth" replace />;

  const draftKey = `wm-profile-setup-draft-${user.id}`;
  const completionPct = Math.round((step / 3) * 100);
  const encouragement = step === 1 ? "Great start - this helps students trust who they are trading with." : step === 2 ? "Nice! You're halfway there." : "Almost done - one final step.";

  const toggleValue = (key: "interestedCategories" | "sellerCategories" | "sellerFulfillment", value: string) => {
    setForm((prev) => {
      const current = prev[key];
      return {
        ...prev,
        [key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
      };
    });
  };

  const onAvatarPick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image is too large. Use a file under 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm((prev) => ({ ...prev, avatarUrl: String(reader.result) }));
    reader.readAsDataURL(file);
  };

  const validation = {
    fullName: form.fullName.trim().length >= 2 ? "" : "Enter your full name as it appears on campus records.",
    studentId: form.studentId.trim().length >= 5 ? "" : "Student ID looks short. Please double-check it.",
    campus: form.campus ? "" : "Select your campus so we can show nearby listings.",
    whatsapp: /^(0\d{9}|\+233\d{9})$/.test(form.whatsapp.trim()) ? "" : "Enter a valid Ghana number (e.g. 0240000000 or +233240000000).",
    interestedCategories: form.interestedCategories.length > 0 ? "" : "Choose at least one category you care about.",
    buyerBudget: form.role === "seller" || form.buyerBudget ? "" : "Pick a rough budget so we can personalize your feed.",
    sellerCategories: form.role === "buyer" || form.sellerCategories.length > 0 ? "" : "Select what you plan to sell.",
    sellerFulfillment: form.role === "buyer" || form.sellerFulfillment.length > 0 ? "" : "Tell buyers how you will deliver items.",
    momoNumber: form.momoNumber && !/^(0\d{9}|\+233\d{9})$/.test(form.momoNumber.trim()) ? "Mobile money number format is invalid." : "",
  };

  const hasStepError = (currentStep: 1 | 2 | 3) => {
    if (currentStep === 1) return Boolean(validation.fullName || validation.studentId || validation.campus || validation.whatsapp);
    if (currentStep === 2) return Boolean(validation.interestedCategories || validation.buyerBudget || validation.sellerCategories || validation.sellerFulfillment);
    return Boolean(validation.momoNumber);
  };

  const showError = (field: keyof typeof validation) => (attempted || touched[field]) && Boolean(validation[field]);

  const nextStep = () => {
    setAttempted(true);
    if (hasStepError(step)) return;
    setAttempted(false);
    if (step < 3) setStep((prev) => (prev + 1) as 1 | 2 | 3);
  };

  const saveForLater = () => {
    localStorage.setItem(draftKey, JSON.stringify(form));
    toast.success("Progress saved. You can finish setup later.");
  };

  const skipForNow = () => {
    localStorage.setItem(draftKey, JSON.stringify(form));
    toast.info("You can complete setup anytime from your profile.");
    navigate("/dashboard");
  };

  const completeSetup = () => {
    setAttempted(true);
    if (hasStepError(3) || hasStepError(2) || hasStepError(1)) return;
    const updatedUser = { ...user, full_name: form.fullName.trim(), avatar_url: form.avatarUrl || user.avatar_url };
    upsertUser(updatedUser);
    localStorage.setItem("wm_user", JSON.stringify(updatedUser));
    window.dispatchEvent(new Event("wm-auth-change"));
    localStorage.setItem("wm-profile-setup", JSON.stringify({ ...form, completedAt: new Date().toISOString(), userId: user.id }));
    localStorage.removeItem(draftKey);
    setCompleted(true);
    toast.success("Profile setup complete");
  };

  return (
    <AppScaffold>
      <section className="container py-8">
        <div className="mx-auto max-w-4xl space-y-5">
          <div className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">P</div>
                  Profite Setup
                </div>
                <h1 className="text-2xl font-bold text-slate-900">Welcome to Profite - Your Campus Marketplace, Made Simple.</h1>
                <p className="mt-1 text-sm text-slate-600">Set up your profile in 3 easy steps. Sell, buy, or just browse - your way.</p>
              </div>
              <Badge className="w-fit bg-accent/15 text-accent hover:bg-accent/20">{completionPct}% complete</Badge>
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                <span>Step {step} of 3</span>
                <span>{encouragement}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${completionPct}%` }} />
              </div>
              <div className="mt-2 grid grid-cols-3 text-xs text-slate-500">
                <span className={step >= 1 ? "font-semibold text-primary" : ""}>1. Profile</span>
                <span className={step >= 2 ? "font-semibold text-primary" : ""}>2. Preferences</span>
                <span className={step >= 3 ? "font-semibold text-primary" : ""}>3. Payment (Optional)</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-slate-700">
            <div className="flex items-start gap-2">
              <Lock className="mt-0.5 h-4 w-4 text-emerald-700" />
              <p>
                <span className="font-semibold text-slate-900">We protect your data.</span> Your info is encrypted and never shared without permission.{" "}
                <a className="font-medium text-primary underline" href="#" onClick={(e) => e.preventDefault()}>Privacy Policy</a> and{" "}
                <a className="font-medium text-primary underline" href="#" onClick={(e) => e.preventDefault()}>Terms</a>.
              </p>
            </div>
          </div>

          {completed ? (
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="space-y-4 p-6 text-center sm:p-8">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle2 className="h-7 w-7 text-emerald-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Verified Student - You're all set!</h2>
                <p className="text-sm text-slate-600">You are ready to buy, sell, or explore the campus marketplace with confidence.</p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button onClick={() => navigate("/marketplace")}>Start Browsing</Button>
                  <Button variant="outline" onClick={() => navigate("/dashboard")}>Go to Dashboard</Button>
                  <Button variant="outline" onClick={() => toast.success("Referral link copied!")}>Refer a Friend</Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="space-y-6 p-6 sm:p-8">
                {step === 1 && (
                  <div className="space-y-5">
                    <div className="rounded-xl border bg-slate-50 p-4">
                      <p className="mb-2 text-sm font-semibold text-slate-900">Profile photo</p>
                      <p className="mb-3 text-xs text-slate-500">Add a clear photo so other students can trust who they are buying from.</p>
                      <div className="flex flex-wrap items-center gap-3">
                        <Avatar className="h-16 w-16 border border-slate-200">
                          <AvatarImage src={form.avatarUrl} />
                          <AvatarFallback className="bg-primary/10 text-primary">{form.fullName.slice(0, 2).toUpperCase() || "U"}</AvatarFallback>
                        </Avatar>
                        <div className="flex gap-2">
                          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm hover:bg-slate-50">
                            <ImagePlus className="h-4 w-4" />
                            Upload Photo
                            <input type="file" accept="image/*" className="hidden" onChange={onAvatarPick} />
                          </label>
                          {form.avatarUrl && (
                            <Button type="button" variant="outline" onClick={() => setForm((prev) => ({ ...prev, avatarUrl: "" }))}>
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">How will you use Profite? *</p>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {([
                          ["buyer", "Buyer", "I mostly shop on campus"],
                          ["seller", "Seller", "I list products and earn"],
                          ["both", "Both", "I buy and sell"],
                        ] as const).map(([value, label, hint]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setForm((prev) => ({ ...prev, role: value }))}
                            className={`rounded-xl border p-3 text-left ${form.role === value ? "border-primary bg-primary/5" : "border-slate-200 bg-white hover:border-slate-300"}`}
                            aria-pressed={form.role === value}
                          >
                            <p className="font-semibold text-slate-900">{label}</p>
                            <p className="text-xs text-slate-500">{hint}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-semibold text-slate-900">Full Name *</label>
                        <Input value={form.fullName} onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))} onBlur={() => setTouched((t) => ({ ...t, fullName: true }))} aria-invalid={showError("fullName")} />
                        {showError("fullName") && <p className="mt-1 text-xs text-red-600">{validation.fullName}</p>}
                      </div>
                      <div>
                        <label className="mb-1 flex items-center gap-1 text-sm font-semibold text-slate-900">Student ID * <CircleHelp className="h-3.5 w-3.5 text-slate-400" title="This helps us verify you are an active student." /></label>
                        <Input value={form.studentId} onChange={(e) => setForm((prev) => ({ ...prev, studentId: e.target.value }))} onBlur={() => setTouched((t) => ({ ...t, studentId: true }))} aria-invalid={showError("studentId")} />
                        {showError("studentId") && <p className="mt-1 text-xs text-red-600">{validation.studentId}</p>}
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-semibold text-slate-900">Campus *</label>
                        <select className="h-10 w-full rounded-lg border bg-white px-3 text-sm" value={form.campus} onChange={(e) => setForm((prev) => ({ ...prev, campus: e.target.value }))} onBlur={() => setTouched((t) => ({ ...t, campus: true }))} aria-invalid={showError("campus")}>
                          <option value="">Select campus</option>
                          {SETUP_CAMPUSES.map((campus) => <option key={campus} value={campus}>{campus}</option>)}
                        </select>
                        {showError("campus") && <p className="mt-1 text-xs text-red-600">{validation.campus}</p>}
                      </div>
                      <div>
                        <label className="mb-1 flex items-center gap-1 text-sm font-semibold text-slate-900">WhatsApp Number * <CircleHelp className="h-3.5 w-3.5 text-slate-400" title="We'll send order and security updates here." /></label>
                        <Input placeholder="0240000000" value={form.whatsapp} onChange={(e) => setForm((prev) => ({ ...prev, whatsapp: e.target.value }))} onBlur={() => setTouched((t) => ({ ...t, whatsapp: true }))} aria-invalid={showError("whatsapp")} />
                        {showError("whatsapp") && <p className="mt-1 text-xs text-red-600">{validation.whatsapp}</p>}
                      </div>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-5">
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-900">Categories you care about *</label>
                      <p className="mb-2 text-xs text-slate-500">Pick what you want to see first in your marketplace feed.</p>
                      <div className="flex flex-wrap gap-2">
                        {SETUP_CATEGORIES.map((cat) => (
                          <button key={cat} type="button" onClick={() => toggleValue("interestedCategories", cat)} className={`rounded-full border px-3 py-1 text-xs ${form.interestedCategories.includes(cat) ? "border-primary bg-primary text-white" : "border-slate-200 bg-white text-slate-700"}`}>
                            {cat}
                          </button>
                        ))}
                      </div>
                      {showError("interestedCategories") && <p className="mt-1 text-xs text-red-600">{validation.interestedCategories}</p>}
                    </div>

                    {(form.role === "buyer" || form.role === "both") && (
                      <div className="grid gap-4 rounded-xl border bg-slate-50 p-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-sm font-semibold text-slate-900">Typical budget range *</label>
                          <select className="h-10 w-full rounded-lg border bg-white px-3 text-sm" value={form.buyerBudget} onChange={(e) => setForm((prev) => ({ ...prev, buyerBudget: e.target.value }))} onBlur={() => setTouched((t) => ({ ...t, buyerBudget: true }))} aria-invalid={showError("buyerBudget")}>
                            <option value="">Choose a range</option>
                            <option value="lt50">Below GHS 50</option>
                            <option value="50to150">GHS 50 - 150</option>
                            <option value="150to300">GHS 150 - 300</option>
                            <option value="gt300">Above GHS 300</option>
                          </select>
                          {showError("buyerBudget") && <p className="mt-1 text-xs text-red-600">{validation.buyerBudget}</p>}
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-semibold text-slate-900">Deal alerts</label>
                          <button type="button" className={`h-10 rounded-lg border px-3 text-sm ${form.buyerNotifications ? "border-primary bg-primary/5 text-primary" : "border-slate-200 bg-white text-slate-600"}`} onClick={() => setForm((prev) => ({ ...prev, buyerNotifications: !prev.buyerNotifications }))}>
                            {form.buyerNotifications ? "On - send me new deals" : "Off - no alerts"}
                          </button>
                        </div>
                      </div>
                    )}

                    {(form.role === "seller" || form.role === "both") && (
                      <div className="space-y-3 rounded-xl border bg-slate-50 p-4">
                        <div>
                          <label className="mb-1 block text-sm font-semibold text-slate-900">What will you sell? *</label>
                          <div className="flex flex-wrap gap-2">
                            {SETUP_CATEGORIES.map((cat) => (
                              <button key={`sell-${cat}`} type="button" onClick={() => toggleValue("sellerCategories", cat)} className={`rounded-full border px-3 py-1 text-xs ${form.sellerCategories.includes(cat) ? "border-primary bg-primary text-white" : "border-slate-200 bg-white text-slate-700"}`}>
                                {cat}
                              </button>
                            ))}
                          </div>
                          {showError("sellerCategories") && <p className="mt-1 text-xs text-red-600">{validation.sellerCategories}</p>}
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-semibold text-slate-900">How can buyers receive items? *</label>
                          <div className="flex flex-wrap gap-2">
                            {["Campus Pickup", "Delivery", "Pickup or Delivery"].map((mode) => (
                              <button key={mode} type="button" onClick={() => toggleValue("sellerFulfillment", mode)} className={`rounded-full border px-3 py-1 text-xs ${form.sellerFulfillment.includes(mode) ? "border-primary bg-primary text-white" : "border-slate-200 bg-white text-slate-700"}`}>
                                {mode}
                              </button>
                            ))}
                          </div>
                          {showError("sellerFulfillment") && <p className="mt-1 text-xs text-red-600">{validation.sellerFulfillment}</p>}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-4">
                    <p className="text-sm text-slate-600">Add payout details now, or skip and do it later from your dashboard.</p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-semibold text-slate-900">Mobile Money Number</label>
                        <Input placeholder="0240000000" value={form.momoNumber} onChange={(e) => setForm((prev) => ({ ...prev, momoNumber: e.target.value }))} onBlur={() => setTouched((t) => ({ ...t, momoNumber: true }))} aria-invalid={showError("momoNumber")} />
                        {showError("momoNumber") && <p className="mt-1 text-xs text-red-600">{validation.momoNumber}</p>}
                      </div>
                      <div>
                        <label className="mb-1 flex items-center gap-1 text-sm font-semibold text-slate-900">Paystack ID <CircleHelp className="h-3.5 w-3.5 text-slate-400" title="Optional for faster top-ups and payouts." /></label>
                        <Input placeholder="Optional" value={form.paystackId} onChange={(e) => setForm((prev) => ({ ...prev, paystackId: e.target.value }))} />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={skipForNow}>Skip for now</Button>
                    <Button variant="outline" onClick={saveForLater}>Save & Finish Later</Button>
                  </div>
                  <div className="flex gap-2">
                    {step > 1 && <Button variant="outline" onClick={() => setStep((prev) => (prev - 1) as 1 | 2 | 3)}>Back</Button>}
                    {step < 3 ? <Button onClick={nextStep}>Continue</Button> : <Button onClick={completeSetup}>Let's Go!</Button>}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="text-center text-xs text-slate-500">
            Need help? <a href="#" className="font-medium text-primary underline" onClick={(e) => e.preventDefault()}>Open setup FAQ</a>
          </div>
        </div>
      </section>
    </AppScaffold>
  );
}

function SimplePage({ title, message }: { title: string; message: string }) {
  return (
    <AppScaffold>
      <section className="container py-10">
        <Card className="max-w-xl"><CardContent className="p-6"><h1 className="page-title">{title}</h1><p className="body-text mt-2">{message}</p><Button asChild className="mt-4"><Link to="/">Back Home</Link></Button></CardContent></Card>
      </section>
    </AppScaffold>
  );
}

export default App;
