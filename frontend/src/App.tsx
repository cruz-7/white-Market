
import { ChangeEvent, FormEvent, useEffect, useState, useRef } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Award, Check, CheckCheck, CheckCircle2, CircleHelp, Clock3, Eye, EyeOff, Flame, GraduationCap, ImagePlus, Info, Lock, MapPin, Megaphone, MessageCircle, Search, Send, ShoppingCart, ShieldCheck, Star, Store, UserRound, Wallet } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

import Navbar from "./Navbar";
import Footer from "./Footer";
import MobileBottomNav from "./MobileBottomNav";
import { ErrorBoundary } from "./ErrorBoundary";
import { CartProvider } from "./CartContext";
import CartPage from "./CartPage";
import { Button } from "./button";
import { Card, CardContent } from "./card";
import { Input } from "./input";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { Textarea } from "./textarea";
import { Badge } from "./badge";
import { Recommendations, SimilarProducts } from "./Recommendations";
import { useRecommendations } from "./useRecommendations";
import {
  LocalUser,
  Message,
  Order,
  getActivities,
  getConversations,
  getMessages,
  getOrders,
  getProducts,
  getWallet,
  getWalletTransactions,
  recordActivity,
  saveConversations,
  saveOrders,
  saveProducts,
  saveWallet,
  saveWalletTransactions,
  subscribeDataChange,
  timeAgo,
  saveMessages,
  upsertUser,
  PRODUCTS_REFRESH_EVENT,
} from "./data";
import { useConvexAuth, useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { api as convexApi } from "../convex/_generated/api";
import { convex, registerConvexAuthBridge } from "./convex-client";
import Index from "./Index";
import ForgotPasswordPage from "./ForgotPasswordPage";
import ResetPasswordPage from "./ResetPasswordPage";
import ChangePasswordPage from "./ChangePasswordPage";
import SettingsPage from "./SettingsPage";
import {
  productsApi,
  ordersApi,
  userApi,
  adminApi,
  messagesApi,
  paymentsApi,
  sellerApi,
  authApi,
  referralsApi,
  verificationApi,
  deliveryApi,
  type AdminUser,
  type AdminProduct,
  type AdminOrder,
  type AdminUserRole,
  type Product as ApiProduct,
  type Order as ApiOrder,
  type Conversation as ApiConversation,
  type ChatMessage,
} from "./api";
import PrivacyPolicy from "./PrivacyPolicy";
import TermsOfService from "./TermsOfService";
import FAQ from "./FAQ";
import ReportIssue from "./ReportIssue";
import BuyerProtection from "./BuyerProtection";
import AddProduct from "./AddProduct";
import SellerProfile from "./SellerProfile";
import ImageSearchModal from "./ImageSearchModal";
import { NotFoundPage } from "./NotFoundPage";
import { adminRouteRedirect, appRoutes, dashboardDestination } from "./route-access";

import ProfessionalOrdersPage from "./ProfessionalOrdersPage";
import CategoriesPage from "./CategoriesPage";
import BooksAndNotesPage from "./BooksAndNotesPage";
import FashionPage from "./FashionPage";
import FavoritesPage from "./FavoritesPage";
import NotificationsPage from "./NotificationsPage";
import ReferralsPage from "./ReferralsPage";
import LeaderboardPage from "./LeaderboardPage";
import SellerDashboard from "./SellerDashboard";
import AdminDashboardView from "./AdminDashboardView";
import RiderDashboard from "./RiderDashboard";

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

export function useCurrentUser() {
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

function normalizeCampusOrderStatus(status: string) {
  switch (status) {
    case "processing":
      return "confirmed";
    case "shipped":
      return "meetup_scheduled";
    case "delivered":
      return "handed_over";
    default:
      return status;
  }
}

function toLocalProduct(product: ApiProduct) {
  const backendAvatar = product.users?.seller_profile_image_url || product.users?.avatar_url;
  const quantity = product.stock_quantity;
  const condition = product.condition?.trim().toLowerCase();
  return {
    id: product.id,
    title: product.title,
    price: Number(product.price || 0),
    sellerId: product.seller_id,
    sellerName: product.users?.seller_display_name || product.users?.full_name || "Seller",
    sellerAvatar: backendAvatar || undefined,
    category: product.category || product.categories?.name || "General",
    image: product.image_url || "https://via.placeholder.com/640x360?text=White+Market",
    description: product.description,
    is_active: product.is_active ?? true,
    stock_status: quantity === undefined
      ? "unknown" as const
      : quantity <= 0
        ? "out_of_stock" as const
        : quantity <= 5
          ? "limited" as const
          : "in_stock" as const,
    stock_quantity: quantity,
    views: Number(product.view_count || 0),
    rating: Number(product.average_rating || product.seller_rating_stats?.avg_overall_rating || 0),
    reviews: Number(product.rating_count || product.seller_rating_stats?.total_ratings || 0),
    average_rating: Number(product.average_rating || 0),
    rating_count: Number(product.rating_count || 0),
    condition: condition
      ? condition.replace(/_/g, " ").replace(/\b\w/g, (letter: string) => letter.toUpperCase())
      : "Not specified",
    verified_seller: product.users?.verified ?? false,
    listed_at: product.created_at || new Date().toISOString(),
  };
}

function toLocalOrder(
  order: ApiOrder & {
    buyer?: { full_name?: string };
    seller?: { full_name?: string };
    users?: { full_name?: string };
  },
  currentUser: LocalUser,
) {
  const buyerName = order.buyer?.full_name || order.users?.full_name || (order.buyer_id === currentUser.id ? currentUser.full_name : "Buyer");
  const sellerName = order.seller?.full_name || order.users?.full_name || (order.seller_id === currentUser.id ? currentUser.full_name : "Seller");

  return {
    id: order.id,
    productId: order.product_id || order.fashion_id || "",
    productTitle: order.products?.title || "Product",
    productImage: order.products?.image_url || "https://via.placeholder.com/320?text=Product",
    buyerId: order.buyer_id,
    buyerName,
    sellerId: order.seller_id,
    sellerName,
    amount: Number(order.amount || 0),
    itemAmount: Number(order.item_amount ?? order.amount ?? 0),
    deliveryFee: Number(order.delivery_fee ?? 0),
    deliveryMethod: order.delivery_method === "delivery" ? "delivery" : "campus_pickup",
    paymentMethod: order.payment_method,
    status: order.status,
    created_at: order.created_at || new Date().toISOString(),
  } as Order;
}

function toLocalConversation(conversation: ApiConversation) {
  return {
    id: conversation.id,
    productId: conversation.product_id,
    productTitle: conversation.product_title,
    productImage: conversation.product_image_url || "https://via.placeholder.com/120?text=Product",
    buyerId: conversation.buyer_id,
    sellerId: conversation.seller_id,
    buyerName: conversation.buyer_name,
    sellerName: conversation.seller_name,
    updated_at: conversation.updated_at,
  };
}

function toLocalMessage(message: ChatMessage) {
  return {
    id: message.id,
    conversationId: message.conversation_id,
    senderId: message.sender_id,
    text: message.text || undefined,
    imageUrl: message.image_url || undefined,
    created_at: message.created_at,
    status: message.status,
  };
}

function AppContent() {
  const currentUser = useCurrentUser();
  const { isLoading: authLoading, isAuthenticated, fetchAccessToken } = useConvexAuth();
  const { signIn, signOut } = useAuthActions();
  const convexAccount = useQuery(
    convexApi.functions.account.me,
    isAuthenticated ? {} : "skip",
  );

  /**
   * Convex Auth only persists the session token when sign-in runs through its
   * React helpers, so the API layer talks to auth through this bridge.
   */
  useEffect(() => {
    registerConvexAuthBridge({
      signIn: (provider, params) => signIn(provider, params as any),
      signOut: () => signOut(),
      refreshClientAuth: () => {
        convex.setAuth((args?: { forceRefreshToken?: boolean }) =>
          fetchAccessToken({ forceRefreshToken: args?.forceRefreshToken ?? false })
        );
      },
    });
    return () => registerConvexAuthBridge(null);
  }, [signIn, signOut, fetchAccessToken]);

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      localStorage.removeItem("wm_user");
      window.dispatchEvent(new Event("wm-auth-change"));
      return;
    }

    const profile = convexAccount?.user;
    if (!profile) return;

    const existing = readCurrentUser();
    const syncedUser: LocalUser = {
      id: profile.id,
      email: profile.email || existing?.email || "",
      full_name: profile.full_name || existing?.full_name || "User",
      role: (profile.role as LocalUser["role"]) || "user",
      avatar_url: profile.avatar_url ?? existing?.avatar_url,
    };

    if (
      existing?.id === syncedUser.id &&
      existing.email === syncedUser.email &&
      existing.full_name === syncedUser.full_name &&
      existing.role === syncedUser.role &&
      existing.avatar_url === syncedUser.avatar_url
    ) {
      return;
    }

    localStorage.setItem("wm_user", JSON.stringify(syncedUser));
    upsertUser(syncedUser);
    window.dispatchEvent(new Event("wm-auth-change"));
  }, [authLoading, isAuthenticated, convexAccount]);

  // Fetch products for unauthenticated users too
  useEffect(() => {
    let cancelled = false;

    const fetchProductsOnly = async () => {
      const productsRes = await productsApi.getAll();
      if (cancelled) return;
      if (productsRes.data) {
        saveProducts(productsRes.data.map(toLocalProduct));
      } else if (productsRes.error) {
        console.error("[marketplace] Failed to load products:", productsRes.error);
      }
    };

    void fetchProductsOnly();

    return () => { cancelled = true; };
  }, []);

  // Re-fetch products when data changes (e.g., seller profile updated)
  useEffect(() => {
    let cancelled = false;
    const handleDataChange = async () => {
      if (cancelled) return;
      const productsRes = await productsApi.getAll();
      if (!cancelled && productsRes.data) {
        saveProducts(productsRes.data.map(toLocalProduct));
      } else if (!cancelled && productsRes.error) {
        console.error("[marketplace] Failed to refresh products:", productsRes.error);
      }
    };
    window.addEventListener(PRODUCTS_REFRESH_EVENT, handleDataChange);
    return () => {
      cancelled = true;
      window.removeEventListener(PRODUCTS_REFRESH_EVENT, handleDataChange);
    };
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;

    const syncBackendData = async () => {
      const [productsRes, myOrdersRes, salesRes, walletRes, txRes, conversationsRes] = await Promise.all([
        productsApi.getAll(),
        ordersApi.getMyOrders(),
        ordersApi.getSales(),
        userApi.getWallet(),
        userApi.getTransactions(),
        messagesApi.getConversations(),
      ]);

      if (cancelled) return;

      if (productsRes.data) {
        saveProducts(productsRes.data.map(toLocalProduct));
      }

      const allOrders = [...(myOrdersRes.data || []), ...(salesRes.data || [])];
      if (allOrders.length > 0) {
        const deduped = Array.from(new Map(allOrders.map((item) => [item.id, item])).values());
        saveOrders(deduped.map((order) => toLocalOrder(order as any, currentUser)));
      }

      if (walletRes.data) {
        saveWallet({
          user_id: currentUser.id,
          balance: Number(walletRes.data.balance || 0),
          pending_earnings: Number(walletRes.data.pending_earnings || 0),
          currency: "GHS",
          updated_at: new Date().toISOString(),
        });
      }

      if (txRes.data) {
        const tx = txRes.data.map((item: any) => ({
          id: item.id,
          user_id: item.user_id,
          type: item.type,
          amount: Number(item.amount || 0),
          description: item.description || "",
          reference_id: item.reference_id || undefined,
          balance_after: Number(item.balance_after || 0),
          created_at: item.created_at || new Date().toISOString(),
        }));
        saveWalletTransactions(currentUser.id, tx);
      }

      if (conversationsRes.data?.conversations) {
        try {
          const localConversations = conversationsRes.data.conversations.map(toLocalConversation);
          saveConversations(localConversations);

          const allMessages: Message[] = [];
          await Promise.all(
            localConversations.map(async (conversation) => {
              try {
                const conversationMessages = await messagesApi.getConversationMessages(conversation.id);
                if (conversationMessages.data?.messages) {
                  allMessages.push(...conversationMessages.data.messages.map(toLocalMessage));
                }
              } catch (e) {
                console.error("Error fetching conversation messages:", e);
              }
            }),
          );
          saveMessages(allMessages.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at)));
        } catch (e) {
          console.error("Error processing conversations:", e);
        }
      }
    };

    syncBackendData();
    const interval = window.setInterval(syncBackendData, 25000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [currentUser?.id]);

  return (
    <Routes>
      <Route path={appRoutes.home} element={<Index />} />
      <Route path={appRoutes.marketplace} element={<MarketplacePage />} />
      <Route path="/product/:id" element={<ProductDetailPage />} />
      <Route path={appRoutes.checkout} element={<CheckoutPage />} />
      <Route path={appRoutes.paymentCallback} element={<PaymentCallbackPage />} />
      <Route path="/messages" element={<MessagesPage />} />
      <Route path="/orders" element={<ProfessionalOrdersPage user={currentUser} />} />
      <Route path="/rider" element={<AppScaffold><RiderDashboard user={currentUser} /></AppScaffold>} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/signup" element={<SignupRedirect />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/change-password" element={<ChangePasswordPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/dashboard" element={<DashboardRouter />} />
      <Route path="/dashboard/overview" element={<SellerDashboard initialTab="overview" />} />
      <Route path="/dashboard/products" element={<SellerDashboard initialTab="products" />} />
      <Route path="/dashboard/orders" element={<SellerDashboard initialTab="orders" />} />
      <Route path="/dashboard/customers" element={<SellerDashboard initialTab="customers" />} />
      <Route path="/dashboard/reviews" element={<SellerDashboard initialTab="reviews" />} />
      <Route path="/dashboard/transactions" element={<SellerDashboard initialTab="transactions" />} />
      <Route path="/dashboard/coupons" element={<SellerDashboard initialTab="coupons" />} />
      <Route path="/dashboard/notifications" element={<SellerDashboard initialTab="notifications" />} />
      <Route path={appRoutes.admin} element={<AdminRoute />} />
      <Route path="/profile-setup" element={<ProfileSetupPage />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<TermsOfService />} />
      <Route path="/faq" element={<FAQ />} />
      <Route path={appRoutes.report} element={<ReportIssue />} />
      <Route path="/buyer-protection" element={<BuyerProtection />} />
      <Route path="/add-product" element={<AddProduct />} />
      <Route path="/edit-product/:id" element={<AddProduct />} />
      <Route path="/seller/:id" element={<SellerProfile />} />
      <Route path="/categories" element={<CategoriesPage />} />
      <Route path="/categories/:slug" element={<CategoriesPage />} />
      <Route path={appRoutes.books} element={<BooksAndNotesPage />} />
      <Route path={appRoutes.bookListing} element={<BooksAndNotesPage />} />
      <Route path={appRoutes.fashion} element={<FashionPage />} />
      <Route path={appRoutes.fashionListing} element={<FashionPage />} />
      <Route path="/favorites" element={<FavoritesPage />} />
      <Route path="/notifications" element={<NotificationsPage />} />
      <Route path="/referrals" element={<ReferralsPage />} />
      <Route path="/leaderboard" element={<LeaderboardPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

function SignupRedirect() {
  const [params] = useSearchParams();
  const referralCode = params.get("ref");
  const signupUrl = `/auth?tab=signup&role=user${referralCode ? `&ref=${encodeURIComponent(referralCode)}` : ""}`;
  return <Navigate to={signupUrl} replace />;
}

function getPasswordStrength(password: string) {
  const hasLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const requirementsCount = [hasLength, hasUpper, hasLower, hasNumber].filter(Boolean).length;
  return {
    hasLength,
    hasUpper,
    hasLower,
    hasNumber,
    requirementsCount,
    strength: requirementsCount <= 1 ? "weak" : requirementsCount <= 3 ? "medium" : "strong",
  };
}

async function handleLogin(email: string, password: string, navigate: ReturnType<typeof useNavigate>) {
  if (!email.trim() || !password.trim()) return;
  const normalizedEmail = email.trim().toLowerCase();

  const { data, error } = await authApi.login({ email: normalizedEmail, password });
  if (error) {
    toast.error(error || "Login failed. Check your credentials.");
    return;
  }

  const signedInUser = data?.user;
  if (!signedInUser) {
    toast.error("Login failed. Check your credentials.");
    return;
  }

  const sessionUser: LocalUser = {
    id: signedInUser.id,
    email: signedInUser.email || normalizedEmail,
    full_name: signedInUser.full_name || normalizedEmail.split("@")[0],
    role: (signedInUser.role as LocalUser["role"]) || "user",
    avatar_url: signedInUser.avatar_url ?? undefined,
    verified: signedInUser.verified ?? false,
  };

  upsertUser(sessionUser);
  localStorage.setItem("wm_user", JSON.stringify(sessionUser));
  window.dispatchEvent(new Event("wm-auth-change"));
  toast.success("Signed in successfully");
  navigate(sessionUser.role === "admin" ? "/admin" : "/dashboard");
}

async function handleSignup(
  fullName: string,
  email: string,
  password: string,
  role: "user" | "seller",
  documentType: "student_id" | "admission_letter",
  documentFile: File,
  navigate: ReturnType<typeof useNavigate>,
  referralCode?: string
) {
  if (!fullName.trim() || !email.trim()) return;
  const normalizedEmail = email.trim().toLowerCase();

  const { data, error } = await authApi.signup({
    email: normalizedEmail,
    password,
    full_name: fullName.trim(),
    role,
  });

  if (error) {
    toast.error(error);
    return;
  }

  const createdUser = data?.user;
  if (!createdUser) {
    toast.error("Your account was created, but its profile could not be loaded. Please sign in to continue.");
    return;
  }

  const sessionUser: LocalUser = {
    id: createdUser.id,
    full_name: createdUser.full_name || fullName.trim(),
    email: createdUser.email || normalizedEmail,
    role: (createdUser.role as LocalUser["role"]) || "user",
    verified: createdUser.verified ?? false,
  };

  const verificationResult = await verificationApi.submitDocument(documentFile, documentType);

  if (referralCode) {
    const referralResult = await referralsApi.claimForNewUser(referralCode);
    if (referralResult.error) {
      toast.info(`Account created, but the referral code could not be applied: ${referralResult.error}`);
    } else if (referralResult.data?.message === "Invalid referral code") {
      toast.info("Account created, but the referral code was invalid.");
    }
  }

  if (verificationResult.error) {
    toast.error(`Account created, but the verification document was not submitted: ${verificationResult.error}`);
  } else {
    toast.success("Account created. You can browse while an admin reviews your student document.");
  }

  upsertUser(sessionUser);
  localStorage.setItem("wm_user", JSON.stringify(sessionUser));
  window.dispatchEvent(new Event("wm-auth-change"));
  navigate(verificationResult.error ? "/verify" : "/dashboard");
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
  const [documentType, setDocumentType] = useState<"student_id" | "admission_letter">("student_id");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    setTab(params.get("tab") === "signup" ? "signup" : "login");
    if (params.get("role") === "seller") setRole("seller");
    else if (params.get("role") === "user") setRole("user");
  }, [params]);

  const pwdStrength = getPasswordStrength(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const normalizedEmail = email.trim().toLowerCase();
  const allowedDomain = normalizedEmail.endsWith("@st.ug.edu.gh") || normalizedEmail.endsWith("@ug.edu.gh");
  const canSubmitLogin = Boolean(email.trim() && password.trim());
  const canSubmitSignup = Boolean(fullName.trim() && email.trim() && allowedDomain && pwdStrength.hasLength && pwdStrength.hasUpper && pwdStrength.hasLower && pwdStrength.hasNumber && passwordsMatch && documentFile);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (tab === "login") {
      await handleLogin(email, password, navigate);
      return;
    }
    if (!documentFile) {
      toast.error("Upload your University of Ghana student ID or admission letter to register.");
      return;
    }
    await handleSignup(
      fullName,
      email,
      password,
      role,
      documentType,
      documentFile,
      navigate,
      params.get("ref") || undefined
    );
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
                <img src="/logo.svg" alt="White Market logo" className="h-11 w-11 rounded-xl" />
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
                <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Manual student document review</p>
                <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Secure wallet checkout and refunds</p>
                <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Buyer protection on eligible orders</p>
              </div>
            </div>

            <CardContent className="p-6 sm:p-8">
              <div className="mb-6 md:hidden">
                <img src="/logo.svg" alt="White Market logo" className="mb-3 h-10 w-10 rounded-xl" />
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
                      <label htmlFor="account-type" className="mb-2 block text-sm font-semibold text-slate-900">Account type</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" id="role-user" onClick={() => setRole("user")} className={`rounded-xl border p-3 text-left transition ${role === "user" ? "border-primary bg-primary/5" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                          <GraduationCap className={`mb-1 h-5 w-5 ${role === "user" ? "text-primary" : "text-slate-500"}`} />
                          <p className="text-sm font-semibold text-slate-900">Student</p>
                          <p className="text-xs text-slate-500">Browse and buy</p>
                        </button>
                        <button type="button" id="role-seller" onClick={() => setRole("seller")} className={`rounded-xl border p-3 text-left transition ${role === "seller" ? "border-primary bg-primary/5" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                          <Store className={`mb-1 h-5 w-5 ${role === "seller" ? "text-primary" : "text-slate-500"}`} />
                          <p className="text-sm font-semibold text-slate-900">Seller</p>
                          <p className="text-xs text-slate-500">List and earn</p>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="full-name" className="mb-1 block text-sm font-semibold text-slate-900">Full Name</label>
                      <Input id="full-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ama Mensah" className="h-11 rounded-lg" />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="verification-document-type" className="block text-sm font-semibold text-slate-900">
                        Student verification document
                      </label>
                      <select
                        id="verification-document-type"
                        value={documentType}
                        onChange={(event) => setDocumentType(event.target.value as "student_id" | "admission_letter")}
                        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                      >
                        <option value="student_id">University of Ghana student ID</option>
                        <option value="admission_letter">University of Ghana admission letter</option>
                      </select>
                      <Input
                        id="verification-document"
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          if (file && file.size > 5 * 1024 * 1024) {
                            toast.error("Verification documents must be 5MB or smaller.");
                            event.target.value = "";
                            setDocumentFile(null);
                            return;
                          }
                          setDocumentFile(file);
                        }}
                        className="h-auto min-h-11 rounded-lg py-2"
                      />
                      <p className="text-xs text-slate-500">
                        Upload a PDF, JPEG, PNG, or WebP file (maximum 5MB). Your account is available immediately, but buying and selling unlock after admin approval.
                      </p>
                    </div>
                  </>
                )}

                <div>
                  <label htmlFor="email" className="mb-1 block text-sm font-semibold text-slate-900">{tab === "signup" ? "University Email" : "Email"}</label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@st.ug.edu.gh" className="h-11 rounded-lg" />
                  {tab === "signup" && <p className="mt-1 text-xs text-slate-500">Only @st.ug.edu.gh and @ug.edu.gh emails are accepted.</p>}
                </div>

                <div>
                  <label htmlFor="password" className="mb-1 block text-sm font-semibold text-slate-900">Password</label>
                  <div className="relative">
                    <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={tab === "signup" ? "Min 8 chars, 1 uppercase, 1 number" : "••••••••"} className="h-11 rounded-lg pr-10" />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {tab === "signup" && (
                    <div className="mt-2 h-2 rounded-full bg-slate-200">
                      <div className={`h-2 rounded-full transition-all ${pwdStrength.strength === "weak" ? "w-1/3 bg-red-500" : pwdStrength.strength === "medium" ? "w-2/3 bg-amber-500" : "w-full bg-green-500"}`} />
                    </div>
                  )}
                </div>

                {tab === "signup" && (
                  <div>
                    <label htmlFor="confirm-password" className="mb-1 block text-sm font-semibold text-slate-900">Confirm Password</label>
                    <div className="relative">
                      <Input id="confirm-password" type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="h-11 rounded-lg pr-10" />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                        onClick={() => setShowConfirmPassword((v) => !v)}
                        aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                        title={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {confirmPassword && !passwordsMatch && <p className="mt-1 text-xs text-red-500">Passwords do not match</p>}
                  </div>
                )}

                <Button type="submit" className="h-11 w-full rounded-lg" disabled={tab === "login" ? !canSubmitLogin : !canSubmitSignup}>
                  {tab === "login" ? "Sign In" : "Create Account"}
                </Button>

                {tab === "login" && (
                  <p className="text-center text-sm">
                    <Link to="/forgot-password" className="text-purple-600 hover:underline font-medium">
                      Forgot your password?
                    </Link>
                  </p>
                )}

                <p className="text-center text-xs text-slate-500">
                  By continuing, you agree to{" "}
                  <Link to="/terms" className="underline hover:text-primary">Terms of Service</Link>{" "}
                  and{" "}
                  <Link to="/privacy" className="underline hover:text-primary">Privacy Policy</Link>.
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
  const [params] = useSearchParams();
  const user = useCurrentUser();
  const [searchQuery, setSearchQuery] = useState(() => params.get("search") || "");
  const [category, setCategory] = useState(() => params.get("category") || "All");
  const [sort, setSort] = useState("popular");
  const [showVerification, setShowVerification] = useState(false);
  const [showImageSearch, setShowImageSearch] = useState(false);

  const paramsSearch = params.get("search") || "";
  const paramsCategory = params.get("category") || "All";

  useEffect(() => {
    setSearchQuery(paramsSearch);
    setCategory(paramsCategory);
  }, [paramsSearch, paramsCategory]);

  const allProducts = getProducts().filter((p) => p.is_active);
  const categories = ["All", ...Array.from(new Set(allProducts.map((p) => p.category)))];
  const selectedCategory = categories.includes(category) ? category : "All";
  const campusTrendingTopics = ["Sneakers", "Perfumes", "Food", "Thrift Clothes", "Gadgets"];
  const filtered = allProducts.filter((p) => {
    const q = searchQuery.toLowerCase();
    const matchesQuery = p.title.toLowerCase().includes(q) || p.sellerName.toLowerCase().includes(q);
    const matchesCategory = selectedCategory === "All" || p.category === selectedCategory;
    return matchesQuery && matchesCategory;
  });

  const products = [...filtered].sort((a, b) => {
    if (sort === "price_asc") return a.price - b.price;
    if (sort === "price_desc") return b.price - a.price;
    if (sort === "newest") return +new Date(b.listed_at) - +new Date(a.listed_at);
    return b.views - a.views;
  });
  const sponsoredProducts = [...allProducts]
    .sort((a, b) => (b.views + b.reviews + b.rating * 25) - (a.views + a.reviews + a.rating * 25))
    .slice(0, 3);

  const createOrder = async (productId: string) => {
    if (!user) return navigate("/auth?role=user");
    const product = allProducts.find((p) => p.id === productId);
    if (!product || product.stock_status === "out_of_stock") return;
    if (product.stock_quantity === undefined) {
      toast.error("The seller must confirm available stock before this item can be purchased.");
      return;
    }
    const created = await ordersApi.create({ product_id: product.id });
    if (created.error || !created.data) {
      toast.error(created.error || "Failed to create order");
      return;
    }

    const fullOrder = await ordersApi.getById(created.data.order_id);
    if (fullOrder.data) {
      const localOrder = toLocalOrder(fullOrder.data as any, user);
      const nextOrders = [localOrder, ...getOrders().filter((item) => item.id !== localOrder.id)];
      saveOrders(nextOrders);
    }

    toast.success(`${product.title} added to cart`);
    navigate(`/checkout/${created.data.order_id}`);
  };

  const messageSeller = async (productId: string) => {
    if (!user) return navigate("/auth?role=user");
    const product = allProducts.find((p) => p.id === productId);
    if (!product) return;
    const response = await messagesApi.upsertConversation({ product_id: product.id });
    if (response.error || !response.data?.conversation?.id) {
      toast.error(response.error || "Failed to open conversation");
      return;
    }
    navigate(
      `/messages?conversation=${response.data.conversation.id}&prefill=${encodeURIComponent(`Hi, I'm interested in ${product.title}`)}&back=${encodeURIComponent(`/product/${product.id}`)}`,
    );
  };

  const openFeaturedListingFlow = () => {
    if (!user) {
      navigate("/auth?tab=signup&role=seller");
      return;
    }

    if (user.role !== "seller") {
      toast.info("Switch to a seller account to run featured listings.");
      navigate("/profile-setup");
      return;
    }

toast.info("Featured listing slots: GHS 50, GHS 75, and GHS 100.");
    navigate("/dashboard");
  };

  return (
    <AppScaffold>
      <section className="container space-y-8 py-10">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-teal-600 p-6 sm:p-8 shadow-xl">
          {/* Background Decoration */}
          <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          
          <div className="relative z-10">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex-1">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur-sm px-4 py-2 text-sm font-semibold text-white">
                  <ShieldCheck className="h-5 w-5" />
                  Trusted Marketplace
                </div>
                <h1 className="mt-4 text-3xl sm:text-4xl font-bold text-white">Marketplace</h1>
                <p className="mt-2 text-lg text-white/90 max-w-2xl">Find trusted campus listings with clear pricing, meetup options, and direct seller messaging.</p>
              </div>
              <Button 
                variant="outline" 
                onClick={() => setShowVerification(true)}
                className="border-2 border-white/30 bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 hover:text-white"
              >
                <Info className="h-4 w-4 mr-2" />
                How Verification Works
              </Button>
            </div>
            
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl bg-white/10 backdrop-blur-sm p-4 border border-white/20">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-white/20 p-2">
                    <ShieldCheck className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">Returns</p>
                    <p className="text-sm text-white/80">Request support within 24 hours if item differs from listing.</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl bg-white/10 backdrop-blur-sm p-4 border border-white/20">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-white/20 p-2">
                    <Wallet className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">Refunds</p>
                    <p className="text-sm text-white/80">Approved cases refunded to wallet balance after review.</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl bg-white/10 backdrop-blur-sm p-4 border border-white/20">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-white/20 p-2">
                    <MessageCircle className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">Disputes</p>
                    <p className="text-sm text-white/80">Campus support reviews evidence fairly.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Card className="border-orange-200 bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 shadow-lg overflow-hidden">
          <CardContent className="space-y-4 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-orange-100 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-orange-800">
                  <Flame className="h-4 w-4" /> Campus Demand
                </div>
                <h2 className="mt-3 text-2xl font-bold text-slate-900">🔥 Trending in Legon</h2>
                <p className="mt-1 text-sm text-slate-600">Students are actively browsing these categories right now. Jump on the trend!</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {campusTrendingTopics.map((topic) => (
                <button
                  key={topic}
                  className="group inline-flex items-center gap-2 rounded-full border-2 border-orange-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:border-orange-400 hover:bg-orange-50 hover:text-orange-800 hover:shadow-md"
                  onClick={() => {
                    setSearchQuery(topic.toLowerCase());
                    setCategory("All");
                  }}
                >
                  <Search className="h-4 w-4 text-orange-500 group-hover:text-orange-600" />
                  {topic}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 shadow-lg overflow-hidden">
          <CardContent className="space-y-5 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-amber-800">
                  <Megaphone className="h-4 w-4" /> Growth Lever
                </div>
                <h2 className="mt-3 text-2xl font-bold text-slate-900">Sponsored & Featured Listings</h2>
                <p className="mt-1 text-sm text-slate-600">Boost your visibility! Sellers can pay GHS 50 - GHS 100 to appear at the top and get faster sales.</p>
              </div>
              <Button onClick={openFeaturedListingFlow} className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-md">
                <Megaphone className="h-4 w-4 mr-2" />
                Promote a Listing
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {sponsoredProducts.map((product, index) => {
                const badges = [
                  { label: "Sponsored", color: "bg-gradient-to-r from-amber-500 to-orange-500", icon: <Star className="h-3 w-3" /> },
                  { label: "Featured Seller", color: "bg-gradient-to-r from-emerald-500 to-teal-500", icon: <ShieldCheck className="h-3 w-3" /> },
                  { label: "Top Product", color: "bg-gradient-to-r from-purple-500 to-pink-500", icon: <Award className="h-3 w-3" /> }
                ];
                const badge = badges[index];
                return (
                  <Card key={`featured-${product.id}`} className="group overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                    <div className="relative">
                      <img src={product.image} alt={product.title} className="h-32 w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      <div className="absolute top-3 left-3">
                        <span className={`inline-flex items-center gap-1 rounded-full ${badge.color} px-3 py-1.5 text-xs font-semibold text-white shadow-lg`}>                          
                          {badge.icon}
                          {badge.label}
                        </span>
                      </div>
                      <div className="absolute bottom-3 right-3">
                        <span className="rounded-xl bg-white/95 backdrop-blur-sm px-3 py-1.5 text-lg font-bold text-primary shadow-lg">
                          GHS {product.price.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <CardContent className="p-4 space-y-3">
                      <p className="line-clamp-1 text-base font-bold text-slate-900 group-hover:text-primary transition-colors">{product.title}</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <Link to={`/seller/${product.sellerId}`} className="text-sm font-medium text-slate-700 hover:text-primary transition-colors">{product.sellerName}</Link>
                          <div className="flex items-center gap-1 mt-1">
                            <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                            <span className="text-xs text-slate-600">{product.rating > 0 ? product.rating.toFixed(1) : "N/A"}</span>
                          </div>
                        </div>
                        <Button size="sm" variant="outline" className="border-2 hover:bg-slate-50" asChild>
                          <Link to={`/product/${product.id}`}>View</Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-white">
          <CardContent className="grid gap-4 p-5 md:grid-cols-4">
            <div className="relative md:col-span-1">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                placeholder="Search products or sellers" 
                className="pr-14 pl-11 h-12 border-2 focus:border-primary" 
              />
              <Button
                size="icon"
                variant="outline"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-lg border-slate-300 text-slate-600 hover:border-primary hover:text-primary"
                title="Search by image"
                onClick={() => setShowImageSearch(true)}
              >
                <ImagePlus className="h-4 w-4" />
              </Button>
            </div>
            <select 
              aria-label="Category" 
              value={selectedCategory} 
              onChange={(e) => setCategory(e.target.value)} 
              className="h-12 rounded-xl border-2 bg-white px-4 text-sm font-medium focus:border-primary focus:outline-none"
            >
              {categories.map((cat) => <option key={cat}>{cat}</option>)}
            </select>
            <select 
              aria-label="Sort" 
              value={sort} 
              onChange={(e) => setSort(e.target.value)} 
              className="h-12 rounded-xl border-2 bg-white px-4 text-sm font-medium focus:border-primary focus:outline-none"
            >
              <option value="popular">Most Popular</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="newest">Newest</option>
            </select>
            <div className="flex items-center justify-end">
              <div className="rounded-xl bg-primary/10 px-4 py-2.5">
                <p className="text-sm font-semibold text-primary">{products.length} listing{products.length === 1 ? "" : "s"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <ImageSearchModal isOpen={showImageSearch} onClose={() => setShowImageSearch(false)} />

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <Card key={p.id} className="group overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white">
              {/* Product Image with Overlay */}
              <div className="relative overflow-hidden">
                <img src={p.image} alt={p.title} className="h-52 w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                
                {/* Top Badges */}
                <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
                  <div className="flex flex-col gap-2">
                    {p.verified_seller && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/90 backdrop-blur-sm px-2.5 py-1 text-xs font-semibold text-white shadow-lg">
                        <ShieldCheck className="h-3 w-3" /> Verified Student
                      </span>
                    )}
                    {p.stock_status === "limited" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/90 backdrop-blur-sm px-2.5 py-1 text-xs font-semibold text-white shadow-lg">
                        <Clock3 className="h-3 w-3" /> Limited Stock
                      </span>
                    )}
                    {p.stock_status === "out_of_stock" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/90 backdrop-blur-sm px-2.5 py-1 text-xs font-semibold text-white shadow-lg">
                        Sold Out
                      </span>
                    )}
                    {p.stock_status === "unknown" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-700/90 backdrop-blur-sm px-2.5 py-1 text-xs font-semibold text-white shadow-lg">
                        Stock needs confirmation
                      </span>
                    )}
                  </div>
                  <button
                    className="rounded-full bg-white/90 backdrop-blur-sm p-2 shadow-lg hover:bg-white transition-colors"
                    onClick={() => setShowVerification(true)}
                    title="Learn about verification"
                  >
                    <Info className="h-4 w-4 text-slate-700" />
                  </button>
                </div>
                
                {/* Price Tag */}
                <div className="absolute bottom-3 left-3">
                  <div className="rounded-xl bg-white/95 backdrop-blur-sm px-4 py-2 shadow-lg">
                    <p className="text-xl font-bold text-primary">GHS {p.price.toFixed(2)}</p>
                  </div>
                </div>
              </div>
              
              <CardContent className="p-5 space-y-4">
                {/* Title & Category */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{p.category}</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 line-clamp-2 group-hover:text-primary transition-colors">{p.title}</h3>
                </div>
                
                {/* Description */}
                <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">{p.description || "No description provided by the seller."}</p>
                
                {/* Seller Info */}
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  {/* Seller Avatar - robust fallback handling */}
                <Avatar className="h-10 w-10 flex-shrink-0">
                  <AvatarImage
                    src={p.sellerAvatar || undefined}
                    alt={p.sellerName}
                    onError={() => console.warn("[Avatar] Image failed, showing fallback", p.sellerAvatar)}
                  />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                    {p.sellerName?.charAt(0)?.toUpperCase() || "S"}
                  </AvatarFallback>
                </Avatar>
                  <div className="flex-1 min-w-0">
                    <Link 
                      to={`/seller/${p.sellerId}`} 
                      className="font-semibold text-slate-900 hover:text-primary transition-colors truncate block"
                    >
                      {p.sellerName}
                    </Link>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                        <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" /> {p.rating > 0 ? p.rating.toFixed(1) : "N/A"}
                      </span>
                      <span className="text-xs text-slate-400">•</span>
                      <span className="text-xs text-slate-500">{p.reviews > 0 ? p.reviews : "0"} reviews                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Tags */}
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
                    {p.condition}
                  </span>
                  {p.stock_quantity !== undefined && (
                    <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
                      {p.stock_quantity} available
                    </span>
                  )}
                </div>
                
                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-11 border-2 hover:bg-slate-50 hover:border-slate-300 transition-all"
                    onClick={() => messageSeller(p.id)}
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Message
                  </Button>
                  <Button 
                    size="sm" 
                    className="h-11 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-md hover:shadow-lg transition-all"
                    disabled={p.stock_status === "out_of_stock" || p.stock_quantity === undefined}
                    onClick={() => createOrder(p.id)}
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Add to Cart
                  </Button>
                </div>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="w-full h-10 text-primary hover:bg-primary/5"
                  asChild
                >
                  <Link to={`/product/${p.id}`}>View Full Details</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {products.length === 0 && (
          <Card className="border-2 border-dashed border-slate-200 bg-slate-50/50">
            <CardContent className="p-12 text-center">
              <div className="mx-auto w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-6">
                <Search className="h-10 w-10 text-slate-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">
                {allProducts.length === 0 ? "No listings yet" : "No products found"}
              </h3>
              <p className="text-slate-600 mb-6 max-w-md mx-auto">
                {allProducts.length === 0
                  ? "The marketplace is ready for its first student listings. Create an account to post a product."
                  : "We couldn't find products matching your search. Try adjusting your filters or browse all categories."}
              </p>
              {allProducts.length === 0 ? (
                <Button asChild className="bg-gradient-to-r from-primary to-primary/90 shadow-md hover:shadow-lg">
                  <Link to="/auth?tab=signup&role=seller">
                    <Store className="h-4 w-4 mr-2" />
                    Start Selling
                  </Link>
                </Button>
              ) : (
                <Button
                  className="bg-gradient-to-r from-primary to-primary/90 shadow-md hover:shadow-lg"
                  onClick={() => { setSearchQuery(""); setCategory("All"); setSort("popular"); }}
                >
                  <Search className="h-4 w-4 mr-2" />
                  Reset Filters
                </Button>
              )}
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
                A Verified Student has submitted a University of Ghana student ID or admission letter and passed manual administrator review.
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
                <li>Identity and student status confirmed</li>
                <li>Active campus contact details verified</li>
                <li>Monitored for meetup, response, and dispute behavior</li>
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
  const { trackProductView, trackPurchase } = useRecommendations();
  const [product, setProduct] = useState(() => getProducts().find((item) => item.id === id) ?? null);
  const [productLoading, setProductLoading] = useState(!product);

  useEffect(() => {
    let cancelled = false;
    const cachedProduct = getProducts().find((item) => item.id === id);
    if (cachedProduct) {
      setProduct(cachedProduct);
      setProductLoading(false);
      return;
    }

    setProductLoading(true);
    if (!id) {
      setProductLoading(false);
      return;
    }

    void productsApi.getById(id).then(({ data, error }) => {
      if (cancelled) return;
      if (data) {
        const loadedProduct = toLocalProduct(data);
        setProduct(loadedProduct);
        saveProducts([
          ...getProducts().filter((item) => item.id !== loadedProduct.id),
          loadedProduct,
        ]);
      } else if (error) {
        console.error("[product] Failed to load product:", error);
        toast.error(`Could not load product: ${error}`);
      }
      setProductLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [id]);
  
  useEffect(() => {
    if (product) {
      trackProductView(product.id, product.category);
    }
  }, [product?.id]);
  
  if (productLoading) {
    return (
      <AppScaffold>
        <section className="container py-16 text-center text-slate-600">Loading product...</section>
      </AppScaffold>
    );
  }
  if (!product) return <Navigate to="/marketplace" replace />;

  const createOrder = async () => {
    if (!user) return navigate("/auth?role=user");
    const created = await ordersApi.create({ product_id: product.id });
    if (created.error || !created.data) {
      toast.error(created.error || "Failed to create order");
      return;
    }

    const fullOrder = await ordersApi.getById(created.data.order_id);
    if (fullOrder.data) {
      const localOrder = toLocalOrder(fullOrder.data as any, user);
      saveOrders([localOrder, ...getOrders().filter((item) => item.id !== localOrder.id)]);
      recordActivity(`${user.full_name} placed order ${localOrder.id}`, "wallet");
    }

    navigate(`/checkout/${created.data.order_id}`);
  };

  const openMessage = async () => {
    if (!user) return navigate("/auth?role=user");
    const response = await messagesApi.upsertConversation({ product_id: product.id });
    if (response.error || !response.data?.conversation?.id) {
      toast.error(response.error || "Failed to open conversation");
      return;
    }
    navigate(
      `/messages?conversation=${response.data.conversation.id}&prefill=${encodeURIComponent(`Hi, I'm interested in ${product.title}`)}&back=${encodeURIComponent("/marketplace")}`,
    );
  };

  return (
    <AppScaffold>
      <section className="container py-8">
        <div className="mb-4 rounded-xl border bg-white p-5 shadow-sm">
          <h1 className="page-title">Product Details</h1>
          <p className="body-text">Review pricing, seller trust signals, and handover details before you buy.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <img src={product.image} alt={product.title} className="h-80 w-full rounded-xl object-cover" />
          <Card className="shadow-sm">
            <CardContent className="p-6">
              <h1 className="page-title">{product.title}</h1>
              <p className="mt-2 body-text">Sold by {product.sellerName}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className={`rounded-full px-2 py-1 ${product.stock_status === "in_stock" ? "bg-green-100 text-green-700" : product.stock_status === "limited" ? "bg-amber-100 text-amber-700" : product.stock_status === "out_of_stock" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-700"}`}>
                  {product.stock_status === "in_stock" ? "In Stock" : product.stock_status === "limited" ? "Limited Stock" : product.stock_status === "out_of_stock" ? "Sold Out" : "Stock needs confirmation"}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-1">{product.condition}</span>
              </div>
              {product.description && <p className="mt-4 whitespace-pre-wrap text-slate-600">{product.description}</p>}
              <p className="mt-3 text-3xl font-bold text-primary">GHS {product.price.toFixed(2)}</p>
              <div className="mt-6 flex gap-2">
                <Button className="flex-1" onClick={createOrder} disabled={product.stock_quantity === undefined || product.stock_status === "out_of_stock"}><ShoppingCart className="h-4 w-4" /> Buy Now</Button>
                <Button variant="outline" className="flex-1" onClick={openMessage}><MessageCircle className="h-4 w-4" /> Message Seller</Button>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="mt-8">
          <SimilarProducts currentProductId={product.id} category={product.category} />
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

  const refreshWalletData = async () => {
    const [walletRes, txRes] = await Promise.all([userApi.getWallet(), userApi.getTransactions()]);
    if (walletRes.data) {
      saveWallet({
        user_id: user.id,
        balance: Number(walletRes.data.balance || 0),
        pending_earnings: Number(walletRes.data.pending_earnings || 0),
        currency: "GHS",
        updated_at: new Date().toISOString(),
      });
    }
    if (txRes.data) {
      const mapped = txRes.data.map((item: any) => ({
        id: item.id,
        user_id: item.user_id,
        type: item.type,
        amount: Number(item.amount || 0),
        description: item.description || "",
        reference_id: item.reference_id || undefined,
        balance_after: Number(item.balance_after || 0),
        created_at: item.created_at || new Date().toISOString(),
      }));
      saveWalletTransactions(user.id, mapped);
    }
  };

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
          callback: async () => {
            const result = await userApi.topUp(value);
            if (result.error) {
              toast.error(result.error);
              return;
            }
            await refreshWalletData();
            toast.success(`GHS ${value.toFixed(2)} added to your wallet`);
            setOpenTopUp(false);
            setAmount("");
          },
        }).openIframe();
        return;
      }
    }
    const result = await userApi.topUp(value);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    await refreshWalletData();
    toast.success(`GHS ${value.toFixed(2)} added to your wallet`);
    setOpenTopUp(false);
    setAmount("");
  };

  const handleWithdraw = async () => {
    const value = Number(amount);
    if (!value || value <= 0) return;
    const result = await userApi.withdraw(value, user.momo_number);
    if (result.error) return toast.error(result.error);
    await refreshWalletData();
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
        </div>

        {!sellerMode && wallet.balance <= 0 && (
          <div className="mb-4 rounded-xl border border-dashed border-accent/40 bg-accent/5 p-3">
            <p className="text-sm font-medium text-slate-800">Your wallet is empty. Add funds to check out faster.</p>
            <p className="text-xs text-slate-500">First top-up bonus: get free priority support on your next order.</p>
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
                {openTopUp && <div><p className="label-text">Payment Method</p><select aria-label="Payment Method" className="w-full rounded-lg border bg-white p-2 text-sm" value={method} onChange={(e) => setMethod(e.target.value)}><option value="paystack">Paystack (Card/MoMo)</option><option value="momo">Mobile Money</option></select></div>}
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setOpenTopUp(false); setOpenWithdraw(false); }}>Cancel</Button>
                <Button onClick={openTopUp ? handleTopUp : handleWithdraw}>{openTopUp ? "Confirm Top Up" : "Request Withdrawal"}</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </Card>
  );
}

function DashboardRouter() {
  const user = useCurrentUser();
  const destination = dashboardDestination(!!user, user?.role);
  if (destination === "/auth" || destination === "/admin") {
    return <Navigate to={destination} replace />;
  }
  if (destination === "seller") return <SellerDashboard initialTab="overview" />;
  return <StudentDashboard />;
}

function AdminRoute() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const account = useQuery(
    convexApi.functions.account.me,
    isAuthenticated ? {} : "skip",
  );

  if (isLoading || (isAuthenticated && account === undefined)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-slate-500">Checking administrator access...</p>
      </div>
    );
  }

  const redirect = adminRouteRedirect(isAuthenticated, account?.user.role);
  if (redirect) return <Navigate to={redirect} replace />;
  if (!account?.user) return <Navigate to="/marketplace" replace />;

  const user: LocalUser = {
    id: account.user.id,
    email: account.user.email,
    full_name: account.user.full_name,
    role: "admin",
    avatar_url: account.user.avatar_url ?? undefined,
  };

  return <AdminDashboardView user={user} />;
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
      <img src={product.image} alt={product.title} className="h-32 w-full object-cover" />
      <CardContent className="space-y-1 p-3">
        <p className="line-clamp-1 text-sm font-semibold">{product.title}</p>
        <p className="text-xs text-slate-500">by {product.sellerName}</p>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 text-amber-500" /> {product.rating > 0 ? product.rating.toFixed(1) : "N/A"}</span>
          <span>({product.reviews > 0 ? product.reviews : "0"} reviews)</span>
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
  const [wishlist] = useState<string[]>(["p2", "p5"]);
  const { trackProductView, trackPurchase, getRecentlyViewed, getCategoryPreferences } = useRecommendations();
  const [trendingProducts, setTrendingProducts] = useState<any[]>([]);
  const [topSellers, setTopSellers] = useState<any[]>([]);
  const [loadingSections, setLoadingSections] = useState(true);

  useEffect(() => {
    const fetchSections = async () => {
      setLoadingSections(true);
      try {
        // Fetch trending products
        const trendingRes = await productsApi.getTrending(6);
        if (trendingRes.data) {
          setTrendingProducts(trendingRes.data);
        }
        
        // Fetch top sellers
        const sellersRes = await sellerApi.getTopSellers(6);
        if (sellersRes.data?.sellers) {
          setTopSellers(sellersRes.data.sellers);
        }
      } catch (error) {
        console.error("Error fetching sections:", error);
      } finally {
        setLoadingSections(false);
      }
    };
    
    fetchSections();
  }, []);

  if (!user) return <Navigate to="/auth" replace />;

  const allProducts = getProducts().filter((p) => p.is_active);
  const orders = getOrders().filter((o) => o.buyerId === user.id || user.id === "u_student_1");
  const activeOrders = orders.filter((o) => ["pending", "confirmed", "meetup_scheduled", "handed_over"].includes(normalizeCampusOrderStatus(o.status)));
  const history = orders.filter((o) => o.status === "completed");
  const categories = ["All", ...Array.from(new Set(allProducts.map((p) => p.category)))];

  const categoryPreferences = getCategoryPreferences();
  const trackedRecentlyViewed = getRecentlyViewed();
  
  const searched = allProducts.filter((p) => {
    const q = searchQuery.toLowerCase();
    const matchesText = p.title.toLowerCase().includes(q) || p.sellerName.toLowerCase().includes(q);
    const matchesCategory = activeCategory === "All" || p.category === activeCategory;
    return matchesText && matchesCategory;
  });

  const recentlyViewed = trackedRecentlyViewed.length > 0
    ? allProducts.filter((p) => trackedRecentlyViewed.includes(p.id))
    : searched.sort((a, b) => b.views - a.views).slice(0, 4);
  const savedItems = searched.filter((p) => wishlist.includes(p.id));
  const seenSellers = new Set([...recentlyViewed, ...savedItems].map((p) => p.sellerId));
  const preferredCategories = categoryPreferences.length > 0 ? categoryPreferences : [activeCategory === "All" ? "Food" : activeCategory];
  const recommendations = searched.filter((p) => {
    if (wishlist.includes(p.id)) return false;
    if (recentlyViewed.some((rv) => rv.id === p.id)) return false;
    if (seenSellers.has(p.sellerId)) return false;
    return preferredCategories.includes(p.category) || preferredCategories.length === 0;
  }).slice(0, 4);
  const hasAnyData = orders.length > 0 || wishlist.length > 0;

  const onQuickAdd = async (productId: string) => {
    const product = allProducts.find((p) => p.id === productId);
    if (!product) return;
    const created = await ordersApi.create({ product_id: product.id });
    if (created.error || !created.data) {
      toast.error(created.error || "Failed to add order");
      return;
    }

    const orderData = await ordersApi.getById(created.data.order_id);
    if (orderData.data) {
      const localOrder = toLocalOrder(orderData.data as any, user);
      saveOrders([localOrder, ...getOrders().filter((item) => item.id !== localOrder.id)]);
    }
    toast.success(`${product.title} added to your active orders`);
  };

  return (
    <AppScaffold>
      <section className="container space-y-6 py-8">
        <div>
          <h1 className="page-title">Hey {user.full_name.split(" ")[0]}! What do you need today?</h1>
          <p className="body-text">Discover trusted campus sellers, coordinate meetups, and pay faster with your wallet.</p>
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
                <div className="rounded-xl border p-4"><p className="label-text">Step 3</p><p className="font-semibold">Place your first order</p><p className="body-text">Agree on a meetup and review your seller.</p></div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Total Orders", String(orders.length)],
              ["Pending Meetups", String(activeOrders.length)],
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
                description="When you place an order, status updates and meetup timing will appear here."
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
                        <p className="body-text">{o.sellerName} - GHS {o.amount}</p>
                      </div>
                      <Button size="sm" asChild><Link to={`/checkout/${o.id}`}>View Order</Link></Button>
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
              <Recommendations 
                excludeIds={[...wishlist, ...recentlyViewed.map((p) => p.id)]}
                limit={8}
              />
            )}
          </CardContent>
        </Card>
      </section>
    </AppScaffold>
  );
}

// AdminDashboard function removed - replaced with richer AdminDashboardView component

function CheckoutPage() {
  useDataRefresh();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const { orderId } = useParams();
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<Order | null>(() => getOrders().find((item) => item.id === orderId) || null);
  const [deliveryOptions, setDeliveryOptions] = useState<{
    delivery_enabled: boolean;
    locations: { id: string; name: string; category: string; zone_name: string; fee: number }[];
  } | null>(null);
  const [deliveryMethod, setDeliveryMethod] = useState<"campus_pickup" | "delivery">("campus_pickup");
  const [destinationId, setDestinationId] = useState("");
  const [meetingPoint, setMeetingPoint] = useState("");
  const [savingDelivery, setSavingDelivery] = useState(false);
  const [deliveryChoiceDirty, setDeliveryChoiceDirty] = useState(false);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void deliveryApi.publicOptions().then((result) => {
      if (cancelled) return;
      if (result.data) {
        setDeliveryOptions(result.data);
      } else if (result.error) {
        console.error("[checkout] Failed to load delivery options:", result.error);
        toast.error("Delivery options could not be loaded. Campus pickup is still available.");
      }
    });
    return () => { cancelled = true; };
  }, [user?.id]);
  useEffect(() => {
    if (!user || !orderId) return;
    const existing = getOrders().find((item) => item.id === orderId) || null;
    if (existing) {
      setOrder(existing);
    }

    let cancelled = false;
    const fetchOrder = async () => {
      const result = await ordersApi.getById(orderId);
      if (!cancelled && result.data) {
        const localOrder = toLocalOrder(result.data as any, user);
        setOrder(localOrder);
        saveOrders([localOrder, ...getOrders().filter((item) => item.id !== localOrder.id)]);
      } else if (!cancelled && result.error) {
        console.error("[checkout] Failed to refresh order:", result.error);
      }
    };
    fetchOrder();
    return () => {
      cancelled = true;
    };
  }, [orderId, user?.id]);
  useEffect(() => {
    if (!order || order.deliveryMethod !== "delivery") return;
    let cancelled = false;
    void deliveryApi.buyerDeliveryOption(order.id).then((result) => {
      if (cancelled) return;
      if (result.data) {
        setDeliveryMethod("delivery");
        setDestinationId(result.data.destination_id ?? "");
        setMeetingPoint(result.data.meeting_point ?? "");
      } else if (result.error) {
        console.error("[checkout] Failed to load saved delivery selection:", result.error);
        toast.error("Saved delivery details could not be loaded.");
      }
    });
    return () => { cancelled = true; };
  }, [order?.id, order?.deliveryMethod]);

  if (!user) return <Navigate to="/auth" replace />;
  if (!order) return <Navigate to="/orders" replace />;
  const wallet = getWallet(user.id);
  const shortfall = Math.max(0, order.amount - wallet.balance);
  const itemAmount = order.itemAmount ?? order.amount - (order.deliveryFee ?? 0);
  const deliveryChoiceUnsaved = deliveryChoiceDirty;
  const selectedDestination = deliveryOptions?.locations.find((location) => location.id === destinationId);

  const saveDeliveryChoice = async () => {
    if (!orderId || !order) return;
    if (deliveryMethod === "delivery" && !destinationId) {
      toast.error("Select a delivery destination.");
      return;
    }
    setSavingDelivery(true);
    const result = await deliveryApi.setDeliveryOption({
      order_id: order.id,
      method: deliveryMethod,
      destination_id: deliveryMethod === "delivery" ? destinationId : undefined,
      meeting_point: deliveryMethod === "delivery" ? meetingPoint : undefined,
    });
    setSavingDelivery(false);
    if (result.error || !result.data) {
      toast.error(result.error || "Could not save your delivery choice.");
      return;
    }
    const nextOrder = {
      ...order,
      amount: Number(result.data.amount),
      itemAmount,
      deliveryFee: Number(result.data.delivery_fee ?? 0),
      deliveryMethod,
    };
    setOrder(nextOrder);
    saveOrders(getOrders().map((item) => item.id === order.id ? nextOrder : item));
    setDeliveryChoiceDirty(false);
    toast.success(deliveryMethod === "delivery" ? "Delivery choice saved." : "Campus pickup selected.");
  };

  const payNow = async () => {
    setLoading(true);
    const result = await paymentsApi.walletPay(order.id);
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }

    saveOrders(getOrders().map((item) => (item.id === order.id
      ? { ...item, status: "paid" as const, paymentMethod: "wallet" }
      : item)));
    await Promise.all([userApi.getWallet(), userApi.getTransactions()]).then(([walletRes, txRes]) => {
      if (walletRes.data) {
        saveWallet({
          user_id: user.id,
          balance: Number(walletRes.data.balance || 0),
          pending_earnings: Number(walletRes.data.pending_earnings || 0),
          currency: "GHS",
          updated_at: new Date().toISOString(),
        });
      }
      if (txRes.data) {
        saveWalletTransactions(
          user.id,
          txRes.data.map((item: any) => ({
            id: item.id,
            user_id: item.user_id,
            type: item.type,
            amount: Number(item.amount || 0),
            description: item.description || "",
            reference_id: item.reference_id || undefined,
            balance_after: Number(item.balance_after || 0),
            created_at: item.created_at || new Date().toISOString(),
          })),
        );
      }
    });

    recordActivity(`Order #${order.id} paid via wallet`, "wallet");
    toast.success("Order paid with wallet successfully");
    navigate("/orders");
  };

  const payWithPaystack = async () => {
    setLoading(true);
    try {
      const callbackUrl = `${window.location.origin}/payment/callback`;
      const result = await paymentsApi.initialize({ order_id: order.id, callback_url: callbackUrl });
      if (result.error) throw new Error(result.error);
      if (!result.data?.authorization_url) {
        throw new Error("Payment provider did not return a checkout link.");
      }
      window.location.assign(result.data.authorization_url);
    } catch (error) {
      console.error("Could not initialize Paystack checkout:", error);
      toast.error(error instanceof Error ? error.message : "Could not start card/Mobile Money checkout.");
      setLoading(false);
    }
  };

  return (
    <AppScaffold>
      <section className="container py-8">
        <div className="mb-4 rounded-xl border bg-white p-5 shadow-sm">
          <h1 className="page-title">Checkout</h1>
          <p className="body-text">Confirm payment securely with wallet balance and transparent order totals.</p>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Card className="shadow-sm"><CardContent className="p-6"><p className="label-text">Order Summary</p><p className="section-title">{order.productTitle}</p><p className="mt-3 text-sm text-slate-600">Merchandise: GHS {itemAmount.toFixed(2)}</p><p className="text-sm text-slate-600">Delivery: GHS {(order.deliveryFee ?? 0).toFixed(2)}{order.deliveryMethod === "campus_pickup" || !order.deliveryMethod ? " (campus pickup)" : ""}</p><p className="mt-1 text-2xl font-bold text-primary">Total: GHS {order.amount.toFixed(2)}</p><p className="mt-2 text-sm text-slate-500">Seller: {order.sellerName}</p></CardContent></Card>
          <Card className="shadow-sm"><CardContent className="space-y-4 p-6">
            <p className="label-text">Delivery choice</p>
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="delivery-method" checked={deliveryMethod === "campus_pickup"} onChange={() => { setDeliveryMethod("campus_pickup"); setDeliveryChoiceDirty(true); }} /> Campus pickup (free)</label>
            {deliveryOptions?.delivery_enabled ? (
              <>
                <label className="flex items-center gap-2 text-sm"><input type="radio" name="delivery-method" checked={deliveryMethod === "delivery"} onChange={() => { setDeliveryMethod("delivery"); setDeliveryChoiceDirty(true); }} /> Request campus delivery</label>
                {deliveryMethod === "delivery" && <>
                  <select className="w-full rounded-md border bg-background p-2 text-sm" value={destinationId} onChange={(event) => { setDestinationId(event.target.value); setDeliveryChoiceDirty(true); }} aria-label="Delivery destination">
                    <option value="">Select destination</option>
                    {deliveryOptions.locations.map((location) => <option key={location.id} value={location.id}>{location.name} · {location.category} · {location.zone_name} · GHS {location.fee.toFixed(2)}</option>)}
                  </select>
                  {selectedDestination && <p className="text-sm text-muted-foreground">Zone: {selectedDestination.zone_name} · Delivery fee: GHS {selectedDestination.fee.toFixed(2)}</p>}
                  <Input value={meetingPoint} onChange={(event) => { setMeetingPoint(event.target.value); setDeliveryChoiceDirty(true); }} placeholder="Public meeting point instructions (no room number)" maxLength={180} />
                </>}
              </>
            ) : <p className="text-xs text-muted-foreground">Campus delivery is intentionally disabled while destination mappings and delivery operations are reviewed. Campus pickup remains available.</p>}
            <Button className="w-full" variant="outline" onClick={saveDeliveryChoice} disabled={savingDelivery || (deliveryMethod === "delivery" && !deliveryOptions?.delivery_enabled)}>{savingDelivery ? "Saving..." : "Save delivery choice"}</Button>
          </CardContent></Card>
          <Card className="shadow-sm"><CardContent className="p-6"><p className="label-text">Wallet Balance</p><p className="text-2xl font-bold">GHS {wallet.balance.toFixed(2)}</p>{deliveryChoiceUnsaved && <p className="mt-2 text-sm text-amber-700">Save your delivery choice before paying.</p>}{wallet.balance >= order.amount ? <Button className="mt-4 w-full" onClick={payNow} disabled={loading || deliveryChoiceUnsaved}>{loading ? "Processing..." : "Pay with Wallet"}</Button> : <><p className="mt-3 text-sm text-red-500">Shortfall: GHS {shortfall.toFixed(2)}</p><Button className="mt-3 w-full" onClick={() => navigate("/dashboard")}>Top Up to Continue</Button></>}<Button variant="outline" className="mt-3 w-full" onClick={payWithPaystack} disabled={loading || deliveryChoiceUnsaved}>{loading ? "Opening secure checkout..." : "Pay by Card or Mobile Money"}</Button></CardContent></Card>
        </div>
      </section>
    </AppScaffold>
  );
}

function PaymentCallbackPage() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [message, setMessage] = useState("Verifying your payment...");
  const [orderId, setOrderId] = useState<string | null>(null);
  const reference = searchParams.get("reference") || searchParams.get("trxref");

  useEffect(() => {
    if (!user || !reference) {
      if (!reference) {
        setStatus("error");
        setMessage("The payment provider did not return a transaction reference.");
      }
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const verification = await paymentsApi.verify(reference);
        if (verification.error) throw new Error(verification.error);
        if (verification.data?.message !== "Payment verified" || !verification.data?.order_id) {
          throw new Error(verification.data?.message || "Payment has not been confirmed.");
        }
        const orderResult = await ordersApi.getById(verification.data.order_id);
        if (orderResult.error || !orderResult.data) {
          throw new Error(orderResult.error || "Payment was confirmed, but order details could not be loaded.");
        }
        const localOrder = toLocalOrder(orderResult.data as ApiOrder, user);
        saveOrders([localOrder, ...getOrders().filter((item) => item.id !== localOrder.id)]);
        if (!cancelled) {
          setOrderId(localOrder.id);
          setStatus("success");
          setMessage("Payment confirmed. Your order is now paid.");
        }
      } catch (error) {
        console.error("Payment verification failed:", error);
        if (!cancelled) {
          setStatus("error");
          setMessage(error instanceof Error ? error.message : "Payment could not be verified.");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [reference, user]);

  if (!user) return <Navigate to="/auth" replace />;
  return (
    <AppScaffold>
      <section className="container py-12">
        <Card className="mx-auto max-w-xl">
          <CardContent className="space-y-4 p-8 text-center">
            <h1 className="text-2xl font-bold">Payment status</h1>
            <p role={status === "error" ? "alert" : "status"}>{message}</p>
            {status === "verifying" && <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />}
            {status === "success" && orderId && <Button onClick={() => navigate(`/orders?orderId=${encodeURIComponent(orderId)}`)}>View order</Button>}
            {status === "error" && <Button variant="outline" onClick={() => navigate("/orders")}>Return to orders</Button>}
          </CardContent>
        </Card>
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
  const [sending, setSending] = useState(false);
  const conversations = getConversations().filter((c) => c.buyerId === user?.id || c.sellerId === user?.id);
  const messages = getMessages();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isMobile = typeof window !== "undefined" ? window.innerWidth < 768 : false;

  useEffect(() => { if (prefill) setDraft(prefill); }, [prefill]);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [selectedId, messages.length]);

  /**
   * Convex reactive queries keep the conversation list and the open thread in
   * sync with the backend, replacing the old Supabase realtime channels.
   */
  const convexConversations = useQuery(convexApi.functions.messages.conversations);
  const convexMessages = useQuery(
    convexApi.functions.messages.messages as any,
    selectedId ? { conversationId: selectedId } : "skip"
  );

  useEffect(() => {
    const remote = (convexConversations as any)?.conversations;
    if (!remote?.length) return;
    saveConversations(remote.map(toLocalConversation));
  }, [convexConversations]);

  useEffect(() => {
    const remote = (convexMessages as any)?.messages;
    if (!remote) return;

    const localMessages = remote.map(toLocalMessage);
    const merged = [...getMessages().filter((item) => item.conversationId !== selectedId), ...localMessages]
      .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
    saveMessages(merged);
  }, [convexMessages, selectedId]);

  if (!user) return <Navigate to="/auth" replace />;

  const filtered = conversations.filter((c) => {
    const person = c.buyerId === user.id ? c.sellerName : c.buyerName;
    return person.toLowerCase().includes(search.toLowerCase()) || c.productTitle.toLowerCase().includes(search.toLowerCase());
  }).sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at));

  const selected = filtered.find((c) => c.id === selectedId) || filtered[0];
  const conversationMessages = selected ? messages.filter((m) => m.conversationId === selected.id) : [];

  const onSend = async () => {
    if (!selected || (!draft.trim() && !uploadingImage) || sending) return;

    const text = draft.trim();
    const imageUrl = uploadingImage;

    setSending(true);
    const response = await messagesApi.sendMessage({
      conversation_id: selected.id,
      text: text || undefined,
      image_url: imageUrl,
    });
    setSending(false);

    if (response.error || !response.data?.message) {
      toast.error(response.error || "Failed to send message");
      return;
    }

    const sent = toLocalMessage(response.data.message);
    const merged = [...getMessages().filter((item) => item.id !== sent.id), sent]
      .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
    saveMessages(merged);
    saveConversations(
      getConversations().map((item) =>
        item.id === selected.id
          ? { ...item, updated_at: sent.created_at, typingBy: undefined }
          : item,
      ),
    );

    setDraft("");
    setUploadingImage(undefined);
  };

  const onDraftChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(e.target.value);
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
              <div className="flex items-center justify-between border-b p-3"><div className="flex items-center gap-2">{isMobile && <button onClick={() => setParams({})} aria-label="Back" title="Back" className="p-1 text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" /></button>}<Avatar className="h-8 w-8"><AvatarFallback>{(selected.buyerId === user.id ? selected.sellerName : selected.buyerName).slice(0, 1)}</AvatarFallback></Avatar><div><p className="text-sm font-semibold">{selected.buyerId === user.id ? selected.sellerName : selected.buyerName}</p><div className="flex items-center gap-1 text-xs text-gray-500"><img src={selected.productImage} alt="Product thumbnail" className="h-4 w-4 rounded object-cover" /><span className="truncate">{selected.productTitle}</span></div></div></div><Info className="h-4 w-4 text-gray-500" /></div>
              <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto bg-gray-50 p-3">{conversationMessages.map((m) => { const mine = m.senderId === user.id; return (<div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}><div className={`max-w-[75%] rounded-2xl px-3 py-2 ${mine ? "bg-primary text-white" : "bg-gray-200 text-gray-900"}`}>{m.imageUrl && <img src={m.imageUrl} alt="Sent content" className="mb-2 max-h-48 rounded-lg" />}{m.text && <p className="text-sm">{m.text}</p>}<div className={`mt-1 flex items-center gap-1 text-[10px] ${mine ? "text-green-100" : "text-gray-500"}`}><span>{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>{mine && <MessageStatusIcon status={m.status} />}</div></div></div>); })}</div>
              <div className="border-t p-3">{uploadingImage && <div className="mb-2 inline-flex items-center gap-2 rounded-lg border bg-white px-2 py-1 text-xs"><img src={uploadingImage} alt="Preview" title="Preview of uploaded image" className="h-8 w-8 rounded object-cover" /><span>Image attached</span></div>}<div className="flex items-end gap-2"><label className="cursor-pointer rounded-lg border p-2" title="Attach image"><ImagePlus className="h-4 w-4" /><input type="file" accept="image/*" className="hidden" onChange={onImagePick} /></label><Textarea value={draft} onChange={onDraftChange} rows={1} placeholder="Type a message" className="min-h-10 resize-none" /><Button onClick={onSend} disabled={sending || (!draft.trim() && !uploadingImage)} aria-label="Send message" title="Send message"><Send className="h-4 w-4" /></Button></div></div>
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

    // Check if profile setup was already completed
    const completedSetup = localStorage.getItem("wm-profile-setup");
    if (completedSetup) {
      try {
        const parsed = JSON.parse(completedSetup);
        if (parsed.userId === user.id && parsed.completedAt) {
          setCompleted(true);
          return;
        }
      } catch {
        // no-op
      }
    }

    // Load draft if exists
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
    sellerFulfillment: form.role === "buyer" || form.sellerFulfillment.length > 0 ? "" : "Tell buyers how you will hand over items.",
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

  const completeSetup = async () => {
    setAttempted(true);
    if (hasStepError(3) || hasStepError(2) || hasStepError(1)) return;
    const role: LocalUser["role"] | undefined = form.role === "seller" ? "seller" : undefined;
    const fullName = form.fullName.trim();
    const avatarUrl = form.avatarUrl || user.avatar_url;
    const { error } = await userApi.updateProfile({
      full_name: fullName,
      avatar_url: avatarUrl,
      campus: form.campus,
      whatsapp: form.whatsapp.trim(),
      momo_number: form.momoNumber.trim() || undefined,
      role,
    });
    if (error) {
      toast.error(`Could not save your profile: ${error}`);
      return;
    }

    const updatedUser = { ...user, full_name: fullName, avatar_url: avatarUrl, role: role ?? user.role };
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
                <Link to="/privacy" className="font-medium text-primary underline">Privacy Policy</Link> and{" "}
                <Link to="/terms" className="font-medium text-primary underline">Terms</Link>.
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
                            aria-pressed={(form.role === value ? "true" : "false") as "true" | "false"}
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
                        <Input value={form.fullName} onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))} onBlur={() => setTouched((t) => ({ ...t, fullName: true }))} aria-invalid={(showError("fullName") ? "true" : "false") as "true" | "false"} />
                        {showError("fullName") && <p className="mt-1 text-xs text-red-600">{validation.fullName}</p>}
                      </div>
                      <div>
                        <label className="mb-1 flex items-center gap-1 text-sm font-semibold text-slate-900">Student ID * <span title="This helps us verify you are an active student."><CircleHelp className="h-3.5 w-3.5 text-slate-400" /></span></label>
                        <Input value={form.studentId} onChange={(e) => setForm((prev) => ({ ...prev, studentId: e.target.value }))} onBlur={() => setTouched((t) => ({ ...t, studentId: true }))} aria-invalid={(showError("studentId") ? "true" : "false") as "true" | "false"} />
                        {showError("studentId") && <p className="mt-1 text-xs text-red-600">{validation.studentId}</p>}
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-semibold text-slate-900">Campus *</label>
                        <select
                          className="h-10 w-full rounded-lg border bg-white px-3 text-sm"
                          aria-label="Campus"
                          value={form.campus}
                          onChange={(e) => setForm((prev) => ({ ...prev, campus: e.target.value }))}
                          onBlur={() => setTouched((t) => ({ ...t, campus: true }))}
                          aria-invalid={(showError("campus") ? "true" : "false") as "true" | "false"}
                        >
                          <option value="">Select campus</option>
                          {SETUP_CAMPUSES.map((campus) => <option key={campus} value={campus}>{campus}</option>)}
                        </select>
                        {showError("campus") && <p className="mt-1 text-xs text-red-600">{validation.campus}</p>}
                      </div>
                      <div>
                        <label className="mb-1 flex items-center gap-1 text-sm font-semibold text-slate-900">WhatsApp Number * <span title="We'll send order and security updates here."><CircleHelp className="h-3.5 w-3.5 text-slate-400" /></span></label>
                        <Input placeholder="0240000000" value={form.whatsapp} onChange={(e) => setForm((prev) => ({ ...prev, whatsapp: e.target.value }))} onBlur={() => setTouched((t) => ({ ...t, whatsapp: true }))} aria-invalid={showError("whatsapp") ? "true" : "false"} />
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
                          <select className="h-10 w-full rounded-lg border bg-white px-3 text-sm" aria-label="Typical budget range" value={form.buyerBudget} onChange={(e) => setForm((prev) => ({ ...prev, buyerBudget: e.target.value }))} onBlur={() => setTouched((t) => ({ ...t, buyerBudget: true }))} aria-invalid={(showError("buyerBudget") ? "true" : "false") as "true" | "false"}>
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
                            {["Campus Meetup", "Pickup Point", "Hall Lobby Handover"].map((mode) => (
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
                        <Input placeholder="0240000000" value={form.momoNumber} onChange={(e) => setForm((prev) => ({ ...prev, momoNumber: e.target.value }))} onBlur={() => setTouched((t) => ({ ...t, momoNumber: true }))} aria-invalid={(showError("momoNumber") ? "true" : "false") as "true" | "false"} />
                        {showError("momoNumber") && <p className="mt-1 text-xs text-red-600">{validation.momoNumber}</p>}
                      </div>
                      <div>
                        <label className="mb-1 flex items-center gap-1 text-sm font-semibold text-slate-900">Paystack ID <span title="Optional for faster top-ups and payouts."><CircleHelp className="h-3.5 w-3.5 text-slate-400" /></span></label>
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
            Need help? <Link to="/faq" className="font-medium text-primary underline">Open setup FAQ</Link>
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

export default function App() {
  return (
    <ErrorBoundary>
      <CartProvider>
        <AppContent />
      </CartProvider>
    </ErrorBoundary>
  );
}
