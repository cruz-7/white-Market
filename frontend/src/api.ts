/**
 * API Service Layer
 * Connects frontend to the Express backend
 * Base URL:
 * - Dev default: http://localhost:5000
 * - Production default: relative paths (same origin/reverse proxy)
 */

import { supabase } from "./supabase-client";

const API_BASE_URL = String(
  import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:5000" : "")
).replace(/\/+$/, "");

interface ApiResponse<T = any> {
  data?: T;
  error?: string;
}

function resolveApiUrl(endpoint: string): string {
  return API_BASE_URL ? `${API_BASE_URL}${endpoint}` : endpoint;
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = resolveApiUrl(endpoint);
  
  // Get token - first try from localStorage, then from Supabase session
  let token: string | null = null;
  
  // First try to get from localStorage
  const userJson = localStorage.getItem("wm_user");
  if (userJson) {
    try {
      token = JSON.parse(userJson).access_token || null;
    } catch {
      token = null;
    }
  }
  
  // If no token in localStorage, try to get from Supabase session
  if (!token && supabase) {
    try {
      // First try to get the session - wait a bit for it to load on page refresh
      let { data: { session } } = await supabase.auth.getSession();
      
      // If no session, wait briefly and try again (handles page refresh race condition)
      if (!session?.access_token) {
        await new Promise(resolve => setTimeout(resolve, 100));
        const result = await supabase.auth.getSession();
        session = result.data.session;
      }
      
      if (session?.access_token) {
        token = session.access_token;
      } else {
        // Try getUser as fallback - it works with persisted session
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Try getting session again after getUser refreshes it
          const { data: { session: newSession } } = await supabase.auth.getSession();
          token = newSession?.access_token || null;
        }
      }
      
      // Debug: log token status
      console.log('Token retrieval:', token ? 'Token found' : 'No token found');
    } catch (err) {
      console.error('Error getting Supabase session:', err);
    }
  } else if (!token) {
    console.log('No supabase client or token already found');
  }
  
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  
  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return { error: data.error || `HTTP ${response.status}: Request failed` };
    }

    return { data };
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error);
    return { error: error instanceof Error ? error.message : "Network error" };
  }
}

// ==================== AUTH API ====================

export interface AuthSignupParams {
  email: string;
  password: string;
  full_name: string;
}

export interface AuthLoginParams {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  email: string;
  user_metadata?: {
    full_name?: string;
  };
}

export interface AuthResponse {
  message?: string;
  user?: AuthUser;
  access_token?: string;
}

export const authApi = {
  signup: (params: AuthSignupParams) =>
    fetchApi<AuthResponse>("/auth/signup", {
      method: "POST",
      body: JSON.stringify(params),
    }),

  login: (params: AuthLoginParams) =>
    fetchApi<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(params),
    }),

  confirmEmail: (email: string) =>
    fetchApi<{ message: string }>("/auth/confirm-email", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  forgotPassword: (email: string) =>
    fetchApi<{ message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  resetPassword: (access_token: string, password: string) =>
    fetchApi<{ message: string; user?: { id: string; email: string } }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ access_token, password }),
    }),

  changePassword: (current_password: string, new_password: string) =>
    fetchApi<{ message: string; user?: { id: string; email: string } }>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ current_password, new_password }),
    }),

  verifyResetToken: (access_token: string) =>
    fetchApi<{ valid: boolean; user_id?: string; error?: string }>("/auth/verify-reset-token?access_token=" + encodeURIComponent(access_token), {
      method: "GET",
    }),
};

// ==================== PRODUCTS API ====================

export interface Product {
  id: string;
  seller_id: string;
  title: string;
  description?: string;
  price: number;
  image_url?: string;
  category_id?: string;
  category?: string;
  is_active?: boolean;
  stock_quantity?: number;
  view_count?: number;
  created_at?: string;
  average_rating?: number;
  rating_count?: number;
  seller_rating_stats?: {
    avg_overall_rating: number;
    total_ratings: number;
  };
  users?: {
    full_name: string;
    email: string;
    verified?: boolean;
    seller_display_name?: string;
    seller_profile_image_url?: string;
    avatar_url?: string;
  };
  categories?: {
    name: string;
    slug: string;
  };
}

export const productsApi = {
  getAll: (params?: string | { 
    q?: string; 
    category_id?: string; 
    min_price?: number; 
    max_price?: number; 
    sort?: "price_asc" | "price_desc" | "newest" | "oldest";
    page?: number;
    limit?: number;
    seller_id?: string;
    is_active?: boolean;
  }) => {
    const normalized = typeof params === "string" ? { q: params } : params;
    const queryParams = new URLSearchParams();
    if (normalized?.q) queryParams.set("q", normalized.q);
    if (normalized?.category_id) queryParams.set("category_id", normalized.category_id);
    if (normalized?.min_price !== undefined) queryParams.set("min_price", String(normalized.min_price));
    if (normalized?.max_price !== undefined) queryParams.set("max_price", String(normalized.max_price));
    if (normalized?.sort) queryParams.set("sort", normalized.sort);
    if (normalized?.page !== undefined) queryParams.set("page", String(normalized.page));
    if (normalized?.limit !== undefined) queryParams.set("limit", String(normalized.limit));
    if (normalized?.seller_id) queryParams.set("seller_id", normalized.seller_id);
    if (normalized?.is_active !== undefined) queryParams.set("is_active", String(normalized.is_active));
    
    const endpoint = queryParams.toString() ? `/products?${queryParams.toString()}` : "/products";
    return fetchApi<Product[]>(endpoint);
  },

  getById: (id: string) =>
    fetchApi<Product>(`/products/${id}`),

  getBySeller: (sellerId: string) =>
    fetchApi<Product[]>(`/products/seller/${sellerId}`),

  // Get trending products
  getTrending: (limit = 10) =>
    fetchApi<Product[]>(`/products?trending=true&limit=${limit}`),

  // Track product view
  trackView: (productId: string) =>
    fetchApi<any>(`/products/${productId}/view`, { method: "POST" }),

  // Track product click
  trackClick: (productId: string) =>
    fetchApi<any>(`/products/${productId}/click`, { method: "POST" }),

  create: (product: { title: string; description?: string; price: number; image_url?: string; category_id?: string }) =>
    fetchApi<{ message: string }>("/products", {
      method: "POST",
      body: JSON.stringify(product),
    }),

  update: (id: string, product: { title?: string; description?: string; price?: number; image_url?: string; category_id?: string; is_active?: boolean; stock_quantity?: number }) =>
    fetchApi<{ message: string; product: Product }>(`/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(product),
    }),

  delete: (id: string) =>
    fetchApi<{ message: string }>(`/products/${id}`, {
      method: "DELETE",
    }),

  recordView: (id: string) =>
    fetchApi<{ message: string }>(`/products/${id}/view`, {
      method: "POST",
    }),

  uploadImage: async (file: File): Promise<ApiResponse<{ image_url: string }>> => {
    const formData = new FormData();
    formData.append("image", file);

    let token: string | null = null;
    const userJson = localStorage.getItem("wm_user");
    if (userJson) {
      try {
        token = JSON.parse(userJson).access_token || null;
      } catch { token = null; }
    }
    if (!token && supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      token = session?.access_token || null;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/products/upload-image`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        return { error: data.error || "Upload failed" };
      }
      return { data };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Upload error" };
    }
  },
};

// ==================== ORDERS API ====================

export interface Order {
  id: string;
  product_id: string;
  buyer_id: string;
  seller_id: string;
  amount: number;
  status: "pending" | "paid" | "cancelled" | "completed" | "disputed";
  created_at: string;
  paid_at?: string;
  completed_at?: string;
  products?: {
    title: string;
    image_url: string;
  };
}

export interface CreateOrderParams {
  product_id: string;
}

export interface UpdateOrderStatusParams {
  status: "cancelled";
}

export const ordersApi = {
  create: (params: CreateOrderParams) =>
    fetchApi<{ message: string; order_id: string; amount: number }>("/orders", {
      method: "POST",
      body: JSON.stringify(params),
    }),

  getMyOrders: () =>
    fetchApi<Order[]>("/orders/my-orders"),

  getSales: () =>
    fetchApi<Order[]>("/orders/sales"),

  getById: (id: string) =>
    fetchApi<Order & { buyer?: { full_name?: string }; seller?: { full_name?: string } }>(`/orders/${id}`),

  updateStatus: (id: string, params: UpdateOrderStatusParams) =>
    fetchApi<{ message: string; order: Order }>(`/orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(params),
    }),

  completeOrder: (id: string) =>
    fetchApi<{ message: string; order: Order; seller_amount: number }>(`/orders/${id}/complete`, {
      method: "POST",
    }),

  createDispute: (id: string, reason: string) =>
    fetchApi<{ message: string; dispute: any }>(`/orders/${id}/dispute`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  getDispute: (id: string) =>
    fetchApi<{ dispute: any }>(`/orders/${id}/dispute`),
};

// ==================== PAYMENTS API ====================

export interface InitializePaymentParams {
  order_id: string;
  callback_url?: string;
}

export interface PaymentResponse {
  message: string;
  authorization_url?: string;
  access_code?: string;
  reference?: string;
}

export const paymentsApi = {
  initialize: (params: InitializePaymentParams) =>
    fetchApi<PaymentResponse>("/payments/initialize", {
      method: "POST",
      body: JSON.stringify(params),
    }),

  walletPay: (order_id: string) =>
    fetchApi<{ message: string; order_id: string; balance: number }>("/payments/wallet-pay", {
      method: "POST",
      body: JSON.stringify({ order_id }),
    }),

  verify: (reference: string) =>
    fetchApi<{ message: string; order_id: string }>(`/payments/verify/${reference}`),
};

// ==================== MESSAGES API ====================

export interface Conversation {
  id: string;
  product_id: string;
  product_title: string;
  product_image_url: string;
  buyer_id: string;
  seller_id: string;
  buyer_name: string;
  seller_name: string;
  updated_at: string;
  unread_count: number;
  last_message?: ChatMessage | null;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  text?: string | null;
  image_url?: string | null;
  created_at: string;
  status: "sent" | "delivered" | "read";
}

export const messagesApi = {
  getConversations: () =>
    fetchApi<{ conversations: Conversation[] }>("/messages/conversations"),

  upsertConversation: (params: { product_id: string; buyer_id?: string }) =>
    fetchApi<{ conversation: { id: string } }>("/messages/conversations/upsert", {
      method: "POST",
      body: JSON.stringify(params),
    }),

  getConversationMessages: (conversationId: string) =>
    fetchApi<{ messages: ChatMessage[] }>(`/messages/conversations/${conversationId}/messages`),

  sendMessage: (params: { conversation_id: string; text?: string; image_url?: string }) =>
    fetchApi<{ message: ChatMessage }>("/messages", {
      method: "POST",
      body: JSON.stringify(params),
    }),
};

// ==================== USER API ====================

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  role?: string;
  avatar_url?: string;
  momo_number?: string;
  campus?: string;
  whatsapp?: string;
}

export const userApi = {
  getProfile: () =>
    fetchApi<UserProfile>("/protected/profile"),

  updateProfile: (data: Partial<UserProfile>) =>
    fetchApi<{ message: string }>("/protected/profile", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  getWallet: () =>
    fetchApi<{ balance: number; pending_earnings: number }>("/protected/wallet"),

  topUp: (amount: number) =>
    fetchApi<{ message: string }>("/protected/wallet/topup", {
      method: "POST",
      body: JSON.stringify({ amount }),
    }),

withdraw: (amount: number, momo_number?: string) =>
    fetchApi<{ message: string }>("/protected/wallet/withdraw", {
      method: "POST",
      body: JSON.stringify({ amount, momo_number }),
    }),

  getTransactions: () =>
    fetchApi<any[]>("/protected/wallet/transactions"),
};

export const sellerApi = {
  getTopSellers: (limit = 3) =>
    fetchApi<{ sellers: any[]; count: number }>(`/sellers/top?limit=${limit}`),

  getProfile: () =>
    fetchApi<{
      id: string;
      full_name: string;
      seller_display_name?: string;
      seller_profile_image_url?: string;
      last_name_change?: string;
      can_change_name: boolean;
      days_remaining: number;
    }>("/protected/seller"),

  updateProfile: (data: { seller_display_name?: string; seller_profile_image_url?: string }) =>
    fetchApi<{ message: string; user?: any; last_name_change?: string; days_remaining?: number }>("/protected/seller", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  uploadProfileImage: async (file: File): Promise<ApiResponse<{ image_url: string }>> => {
    const formData = new FormData();
    formData.append("image", file);

    let token: string | null = null;
    const userJson = localStorage.getItem("wm_user");
    if (userJson) {
      try {
        token = JSON.parse(userJson).access_token || null;
      } catch { token = null; }
    }
    if (!token && supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      token = session?.access_token || null;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/products/upload-image`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        return { error: data.error || "Upload failed" };
      }
      return { data };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Upload error" };
    }
  },
};

// ==================== VERIFICATION API ====================

export interface VerificationStatus {
  verified: boolean;
  verification_status: "none" | "pending" | "approved" | "rejected";
  document_type?: string | null;
  created_at?: string | null;
  is_school_email: boolean;
}

export interface VerificationRequest {
  document_type: "student_id" | "admission_letter";
}

export interface Verification {
  id: string;
  user_id: string;
  document_url?: string | null;
  document_type: string;
  status: "pending" | "approved" | "rejected";
  reviewed_by?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  user?: {
    email: string;
    full_name?: string;
  };
}

export const verificationApi = {
  getStatus: () =>
    fetchApi<VerificationStatus>("/verification/status"),

  submitRequest: (params: VerificationRequest) =>
    fetchApi<{ message: string; verification_id?: string; status: string }>("/verification/request", {
      method: "POST",
      body: JSON.stringify(params),
    }),

  // Admin endpoints
  getAllPending: (status?: string) =>
    fetchApi<{ verifications: Verification[] }>(
      status ? `/admin/verifications?status=${status}` : "/admin/verifications"
    ),

  approve: (id: string) =>
    fetchApi<{ message: string; status: string }>(`/verification/admin/verification/${id}/approve`, {
      method: "PATCH",
    }),

  reject: (id: string, reason?: string) =>
    fetchApi<{ message: string; status: string }>(`/verification/admin/verification/${id}/reject`, {
      method: "PATCH",
      body: JSON.stringify({ reason }),
    }),
};

// ==================== ADMIN API ====================

export type AdminUserRole = "user" | "seller" | "admin" | "banned";

export interface AdminUser {
  id: string;
  full_name?: string | null;
  email: string;
  role: AdminUserRole;
  created_at?: string;
  momo_number?: string | null;
}

export interface AdminProduct {
  id: string;
  seller_id: string;
  title: string;
  price: number;
  image_url?: string | null;
  category?: string | null;
  is_active?: boolean;
  created_at?: string;
  seller?: {
    full_name?: string | null;
    email?: string | null;
  };
}

export interface AdminOrder {
  id: string;
  product_id: string;
  buyer_id: string;
  seller_id: string;
  amount: number;
  status: "pending" | "paid" | "cancelled" | "disputed" | "confirmed";
  created_at: string;
  paid_at?: string | null;
  product?: {
    title?: string | null;
    image_url?: string | null;
  };
  buyer?: {
    full_name?: string | null;
    email?: string | null;
  };
  seller?: {
    full_name?: string | null;
    email?: string | null;
  };
}

export const adminApi = {
  getAllUsers: () =>
    fetchApi<AdminUser[]>("/admin/users"),

  updateUserRole: (userId: string, role: AdminUserRole) =>
    fetchApi<{ message: string }>(`/admin/users/${userId}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }),

  banUser: (userId: string) =>
    fetchApi<{ message: string }>(`/admin/ban-user/${userId}`, {
      method: "PATCH",
    }),

  unbanUser: (userId: string) =>
    fetchApi<{ message: string }>(`/admin/unban-user/${userId}`, {
      method: "PATCH",
    }),

  getAllProducts: () =>
    fetchApi<AdminProduct[]>("/admin/products"),

  removeProduct: (productId: string) =>
    fetchApi<{ message: string }>(`/admin/product/${productId}`, {
      method: "DELETE",
    }),

  getAllOrders: () =>
    fetchApi<AdminOrder[]>("/admin/orders"),

  updateOrderStatus: (orderId: string, status: "pending" | "paid" | "cancelled") =>
    fetchApi<{ message: string; order: AdminOrder }>(`/admin/orders/${orderId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  getStats: () =>
    fetchApi<{
      totalUsers: number;
      totalOrders: number;
      totalRevenue: number;
      totalProducts?: number;
      commission?: number;
    }>("/admin/stats"),

  // Enhanced stats with more details
  getDashboardStats: () =>
    fetchApi<{
      users: { total: number; active: number; newToday: number; newThisWeek: number };
      orders: { total: number; pending: number; completed: number; cancelled: number; revenue: number };
      products: { total: number; active: number; pending: number };
      revenue: { total: number; thisMonth: number; lastMonth: number; averageOrder: number };
      referrals: { total: number; qualified: number; creditsIssued: number };
      growth: { userGrowth: number; orderGrowth: number; revenueGrowth: number };
    }>("/admin/dashboard-stats"),

  // System health
  getSystemHealth: () =>
    fetchApi<{
      status: string;
      database: { connected: boolean; responseTime: number };
      api: { responseTime: number; uptime: number };
      storage: { used: number; total: number };
    }>("/admin/system-health"),

  // Get recent activity
  getRecentActivity: (limit = 20) =>
    fetchApi<any[]>(`/admin/activity?limit=${limit}`),

  // Get top sellers
  getTopSellers: (limit = 10) =>
    fetchApi<any[]>(`/admin/top-sellers?limit=${limit}`),

  // Get revenue analytics
  getRevenueAnalytics: (period: "week" | "month" | "year" = "month") =>
    fetchApi<{ daily: any[]; weekly: any[]; monthly: any[] }>(`/admin/revenue-analytics?period=${period}`),

  // Get user analytics
  getUserAnalytics: () =>
    fetchApi<{ registrations: any[]; byRole: any; byVerification: any }>("/admin/user-analytics"),

  // Get financial stats
  getFinancialStats: () =>
    fetchApi<{
      total_wallet_balance: number;
      total_platform_credit: number;
      seller_liability: number;
      total_transaction_volume: number;
      total_commission: number;
      platform_profit: number;
      paystack_balance: number;
      available_for_withdrawal: number;
      pending_payouts: number;
      completed_payouts: number;
      failed_payouts: number;
      total_referral_credits: number;
      active_referral_credits: number;
      cash_flow: {
        paystack_balance: number;
        seller_liability: number;
        net_platform_funds: number;
      };
      settings: {
        commission_rate: number;
        min_withdrawal: number;
        withdrawal_percentage: number;
        payout_cooldown_hours: number;
      };
    }>("/admin/financial-stats"),

  // Approve payout
  approvePayout: (payoutId: string) =>
    fetchApi<{ success: boolean; message: string }>(`/admin/payouts/${payoutId}/approve`, { method: "POST" }),

  // Reject payout
  rejectPayout: (payoutId: string, reason: string) =>
    fetchApi<{ success: boolean; message: string }>(`/admin/payouts/${payoutId}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  // Freeze/unfreeze user wallet
  freezeWallet: (userId: string, freeze: boolean, fraudFlags?: string[]) =>
    fetchApi<{ success: boolean; message: string }>(`/admin/users/${userId}/freeze-wallet`, {
      method: "POST",
      body: JSON.stringify({ freeze, fraud_flags: fraudFlags }),
    }),

  // Bulk actions
  bulkUpdateUsers: (userIds: string[], action: "ban" | "unban" | "verify") =>
    fetchApi<{ message: string; updated: number }>("/admin/bulk-users", {
      method: "POST",
      body: JSON.stringify({ userIds, action }),
    }),

  bulkUpdateProducts: (productIds: string[], action: "approve" | "reject" | "delete") =>
    fetchApi<{ message: string; updated: number }>("/admin/bulk-products", {
      method: "POST",
      body: JSON.stringify({ productIds, action }),
    }),

  // Export data
  exportData: (type: "users" | "orders" | "products" | "revenue", format: "csv" | "json" = "csv") =>
    fetchApi<any>(`/admin/export?type=${type}&format=${format}`),
};

// ==================== SELLERS API ====================

export interface SellerStats {
  profile: UserProfile;
  stats: {
    products: number;
    totalOrders: number;
    completedOrders: number;
    totalRevenue: number;
    availableBalance: number;
    pendingEarnings: number;
    averageRating: string;
    totalReviews: number;
  };
  recentOrders: Order[];
  topProducts: Product[];
}

export interface SellerPublicProfile {
  seller: {
    id: string;
    full_name: string;
    avatar_url?: string;
    verified: boolean;
    created_at: string;
  };
  stats: {
    products: number;
    averageRating: string;
    totalReviews: number;
  };
  products: Product[];
}

export const sellersApi = {
  getMe: () =>
    fetchApi<SellerStats>("/sellers/me"),

  getById: (id: string) =>
    fetchApi<SellerPublicProfile>(`/sellers/${id}`),

  getAll: () =>
    fetchApi<{ sellers: any[] }>("/sellers"),

  getTop: (limit = 6) =>
    fetchApi<{ sellers: any[]; count: number }>(`/sellers/top?limit=${limit}`),
};

// ==================== CATEGORIES API ====================

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  sort_order: number;
  is_active: boolean;
  product_count?: number;
}

export const categoriesApi = {
  getAll: () =>
    fetchApi<Category[]>("/categories"),

  getById: (id: string) =>
    fetchApi<{ category: Category; products: Product[]; pagination: any }>(`/categories/${id}`),
};

// ==================== REVIEWS API ====================

export interface Review {
  id: string;
  order_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  comment?: string;
  is_seller_review: boolean;
  created_at: string;
  reviewer?: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
}

export const reviewsApi = {
  getForSeller: (sellerId: string, page = 1, limit = 10) =>
    fetchApi<{ reviews: Review[]; rating: number; review_count: number; pagination: any }>(
      `/reviews/seller/${sellerId}?page=${page}&limit=${limit}`
    ),

  getForOrder: (orderId: string) =>
    fetchApi<{ review: Review | null }>(`/reviews/order/${orderId}`),

  create: (review: { order_id: string; rating: number; comment?: string; is_seller_review?: boolean }) =>
    fetchApi<{ review: Review }>("/reviews", {
      method: "POST",
      body: JSON.stringify(review),
    }),

  update: (id: string, review: { rating?: number; comment?: string }) =>
    fetchApi<{ review: Review }>(`/reviews/${id}`, {
      method: "PATCH",
      body: JSON.stringify(review),
    }),
};

// ==================== FAVORITES API ====================

export interface Favorite {
  id: string;
  user_id: string;
  product_id: string;
  created_at: string;
  product?: Product;
}

export const favoritesApi = {
  getAll: () =>
    fetchApi<{ favorites: Favorite[] }>("/favorites"),

  add: (product_id: string) =>
    fetchApi<{ favorite: Favorite }>("/favorites", {
      method: "POST",
      body: JSON.stringify({ product_id }),
    }),

  remove: (productId: string) =>
    fetchApi<{ message: string }>(`/favorites/${productId}`, {
      method: "DELETE",
    }),

  check: (productId: string) =>
    fetchApi<{ is_favorited: boolean }>(`/favorites/check/${productId}`),
};

export const likesApi = {
  getLikeCount: (productId: string) =>
    fetchApi<{ like_count: number }>(`/favorites/likes/product/${productId}`),
  
  like: (productId: string) =>
    fetchApi<{ like: any; like_count: number }>(`/favorites/likes/product/${productId}`, {
      method: "POST",
    }),
  
  unlike: (productId: string) =>
    fetchApi<{ message: string; like_count: number }>(`/favorites/likes/product/${productId}`, {
      method: "DELETE",
    }),
  
  checkLike: (productId: string) =>
    fetchApi<{ is_liked: boolean }>(`/favorites/likes/check/${productId}`),
};

// ==================== SEARCH API ====================

export const searchApi = {
  saveQuery: (query: string) =>
    fetchApi<{ history: any }>("/search/history", {
      method: "POST",
      body: JSON.stringify({ query }),
    }),

  getHistory: (limit = 10) =>
    fetchApi<{ history: { query: string; created_at: string }[] }>(`/search/history?limit=${limit}`),

  clearHistory: () =>
    fetchApi<{ message: string }>("/search/history", {
      method: "DELETE",
    }),

  getSuggestions: (query: string, limit = 5) =>
    fetchApi<{ suggestions: { id: string; title: string; image_url: string }[]; popular: string[] }>(
      `/search/suggestions?q=${encodeURIComponent(query)}&limit=${limit}`
    ),

  searchByImage: async (imageFile: File) => {
    const formData = new FormData();
    formData.append('image', imageFile);

    const url = resolveApiUrl('/search/image');

    // Get token for authentication
    let token: string | null = null;
    const userJson = localStorage.getItem("wm_user");
    if (userJson) {
      try {
        token = JSON.parse(userJson).access_token || null;
      } catch {
        token = null;
      }
    }

    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return { error: data.error || `HTTP ${response.status}: Request failed` };
      }

      return { data };
    } catch (error) {
      console.error('Image search API error:', error);
      return { error: error instanceof Error ? error.message : "Network error" };
    }
  },
};

// ==================== REFERRALS API ====================

export interface ReferralStats {
  referral_code: string;
  referral_link?: string;
  total_referrals: number;
  recent_referrals?: { referred_id: string; created_at: string }[];
  qualified_buyer_referrals?: number;
  qualified_seller_referrals?: number;
  referral_level?: number;
  is_campus_ambassador?: boolean;
}

export const referralsApi = {
  getCode: () =>
    fetchApi<ReferralStats>("/referrals/code"),

  getDashboard: () =>
    fetchApi<any>("/referrals/dashboard"),

  getLeaderboard: (limit = 20) =>
    fetchApi<any[]>(`/referrals/leaderboard?limit=${limit}`),

  getMilestones: () =>
    fetchApi<any[]>("/referrals/milestones"),

  verify: (referral_code?: string, referrer_email?: string) =>
    fetchApi<{ valid: boolean; referrer: { id: string; name: string } }>("/referrals/verify", {
      method: "POST",
      body: JSON.stringify({ referral_code, referrer_email }),
    }),

  claim: (referral_code?: string, referrer_email?: string) =>
    fetchApi<{ message: string }>("/referrals/claim", {
      method: "POST",
      body: JSON.stringify({ referral_code, referrer_email }),
    }),

  getStats: () =>
    fetchApi<{
      total_referrals: number;
      qualified_referrals: number;
      pending_referrals: number;
      buyer_referrals: number;
      seller_referrals: number;
      platform_credit: number;
      commission_discount_remaining: number;
      referral_level: number;
      is_campus_ambassador: boolean;
      referrals: any[];
      rewards: any[];
    }>("/referrals/stats"),

  getAdminStats: () =>
    fetchApi<any>("/referrals/admin-stats"),
};

// ==================== NOTIFICATIONS API ====================

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body?: string;
  data?: any;
  is_read: boolean;
  created_at: string;
}

export const notificationsApi = {
  getAll: (page = 1, limit = 20, unread_only = false) =>
    fetchApi<{
      notifications: Notification[];
      unread_count: number;
      pagination: any;
    }>(`/notifications?page=${page}&limit=${limit}&unread_only=${unread_only}`),

  getUnreadCount: () =>
    fetchApi<{ unread_count: number }>("/notifications/unread-count"),

  markAsRead: (id: string) =>
    fetchApi<{ message: string }>(`/notifications/${id}/read`, {
      method: "PATCH",
    }),

  markAllAsRead: () =>
    fetchApi<{ message: string }>("/notifications/read-all", {
      method: "PATCH",
    }),

  delete: (id: string) =>
    fetchApi<{ message: string }>(`/notifications/${id}`, {
      method: "DELETE",
    }),

  clearAll: () =>
    fetchApi<{ message: string }>("/notifications/clear-all", {
      method: "DELETE",
    }),
};

// ==================== UTILITY ====================

export function isApiConfigured(): boolean {
  return Boolean(import.meta.env.VITE_API_URL || import.meta.env.DEV);
}

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

// ============== Services API ==============
export interface ServiceType {
  id: string;
  name: string;
  icon: string;
  description: string;
  count?: number;
}

export interface Service {
  id: string;
  user_id: string;
  service_type: string;
  title: string;
  description: string;
  price: number;
  price_type: 'fixed' | 'hourly' | 'starting_from';
  location: string;
  availability: string;
  response_time: string;
  is_active: boolean;
  is_verified: boolean;
  rating: number;
  review_count: number;
  completed_jobs: number;
  images: string[];
  created_at: string;
  provider?: {
    id: string;
    full_name: string;
    avatar_url: string;
    is_verified: boolean;
  };
}

export interface ServiceReview {
  id: string;
  service_id: string;
  user_id: string;
  rating: number;
  comment: string;
  created_at: string;
  reviewer?: {
    id: string;
    full_name: string;
    avatar_url: string;
  };
}

export interface ServiceBooking {
  id: string;
  service_id: string;
  user_id: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  notes: string;
  scheduled_date: string;
  scheduled_time: string;
  created_at: string;
  service?: Service;
}

export const servicesApi = {
  // Get all services with optional filters
  getAll: async (
    serviceType?: string,
    limit = 20,
    offset = 0,
    sort = 'created_at.desc'
  ): Promise<ApiResponse<{ services: Service[]; total: number }>> => {
    const params = new URLSearchParams();
    if (serviceType) params.append('service_type', serviceType);
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());
    params.append('sort', sort);
    return fetchApi(`/services?${params.toString()}`);
  },

  // Get service by ID
  getById: async (id: string): Promise<ApiResponse<{ service: Service; reviews: ServiceReview[] }>> => {
    return fetchApi(`/services/${id}`);
  },

  // Get service types with counts
  getTypes: async (): Promise<ApiResponse<ServiceType[]>> => {
    return fetchApi('/services/meta/types');
  },

  // Get provider's own services
  getMyServices: async (): Promise<ApiResponse<Service[]>> => {
    return fetchApi('/services/provider/me');
  },

  // Create new service
  create: async (data: {
    service_type: string;
    title: string;
    description: string;
    price: number;
    price_type: 'fixed' | 'hourly' | 'starting_from';
    location: string;
    availability: string;
    response_time: string;
    images?: string[];
  }): Promise<ApiResponse<{ service: Service }>> => {
    return fetchApi('/services', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Update service
  update: async (
    id: string,
    data: Partial<{
      service_type: string;
      title: string;
      description: string;
      price: number;
      price_type: 'fixed' | 'hourly' | 'starting_from';
      location: string;
      availability: string;
      response_time: string;
      images: string[];
    }>
  ): Promise<ApiResponse<{ service: Service }>> => {
    return fetchApi(`/services/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Delete service
  delete: async (id: string): Promise<ApiResponse<{ success: boolean }>> => {
    return fetchApi(`/services/${id}`, {
      method: 'DELETE',
    });
  },

  // Toggle service active status
  toggle: async (id: string): Promise<ApiResponse<{ service: Service }>> => {
    return fetchApi(`/services/${id}/toggle`, {
      method: 'PATCH',
    });
  },

  // Create service review
  createReview: async (
    serviceId: string,
    data: { rating: number; comment: string }
  ): Promise<ApiResponse<{ review: ServiceReview }>> => {
    return fetchApi(`/services/${serviceId}/reviews`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Create service booking
  createBooking: async (
    serviceId: string,
    data: {
      notes: string;
      scheduled_date: string;
      scheduled_time: string;
    }
  ): Promise<ApiResponse<{ booking: ServiceBooking }>> => {
    return fetchApi(`/services/${serviceId}/bookings`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Get user's bookings (as customer or provider)
  getMyBookings: async (role: 'customer' | 'provider' = 'customer'): Promise<ApiResponse<{ bookings: ServiceBooking[] }>> => {
    return fetchApi(`/services/bookings/me?role=${role}`);
  },

  // Update booking status (provider only)
  updateBooking: async (
    id: string,
    status: 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
  ): Promise<ApiResponse<{ booking: ServiceBooking }>> => {
    return fetchApi(`/services/bookings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },
};

// ==================== WALLET & PAYOUTS API ====================
export interface WalletInfo {
  wallet_balance: number;
  platform_credit: number;
  account_weight: number;
  total_sales: number;
  successful_transactions: number;
  last_sale_at: string | null;
  is_payout_frozen: boolean;
  fraud_flags: string[];
  referral_earnings: number;
  total_referral_credits: number;
  daily_limit: number;
}

export interface WithdrawalLimits {
  wallet_balance: number;
  account_weight: number;
  daily_limit: number;
  min_withdrawal: number;
  withdrawal_percentage: number;
  cooldown_hours: number;
  last_sale_at: string | null;
  is_frozen: boolean;
  fraud_flags: string[];
}

export interface Transaction {
  id: string;
  buyer_id: string;
  seller_id: string;
  order_id: string;
  amount: number;
  commission: number;
  seller_earning: number;
  credit_used: number;
  status: string;
  created_at: string;
}

export interface Payout {
  id: string;
  user_id: string;
  amount: number;
  fee: number;
  net_amount: number;
  momo_number: string;
  network: string;
  status: string;
  failure_reason: string | null;
  created_at: string;
  processed_at: string | null;
}

export const walletApi = {
  // Get wallet information
  getWallet: () =>
    fetchApi<{ wallet: WalletInfo }>("/payouts/wallet"),

  // Get withdrawal limits
  getLimits: () =>
    fetchApi<WithdrawalLimits>("/payouts/limits"),

  // Request withdrawal
  withdraw: (amount: number, momoNumber: string, network: string) =>
    fetchApi<{ success: boolean; message: string; wallet: WalletInfo; payout: any }>(
      "/payouts/withdraw",
      {
        method: "POST",
        body: JSON.stringify({ amount, momo_number: momoNumber, network }),
      }
    ),

  // Check withdrawal eligibility
  checkEligibility: (amount: number) =>
    fetchApi<{ eligible: boolean; reason: string; wallet_balance: number; daily_limit: number }>(
      "/payouts/check-eligibility",
      {
        method: "POST",
        body: JSON.stringify({ amount }),
      }
    ),

  // Get transaction history
  getTransactions: (limit = 50, offset = 0, type?: string) => {
    let url = `/payouts/transactions?limit=${limit}&offset=${offset}`;
    if (type) url += `&type=${type}`;
    return fetchApi<{ transactions: Transaction[]; has_more: boolean }>(url);
  },

  // Get payout history
  getPayoutHistory: (limit = 20, offset = 0) =>
    fetchApi<{ payouts: Payout[]; has_more: boolean }>(
      `/payouts/history?limit=${limit}&offset=${offset}`
    ),

  // Get wallet ledger/history
  getLedger: (limit = 50, offset = 0) =>
    fetchApi<{ ledger: any[]; has_more: boolean }>(
      `/payouts/ledger?limit=${limit}&offset=${offset}`
    ),
};

export const healthApi = {
  check: async (): Promise<ApiResponse<{ status: string }>> => {
    let primaryError: string | undefined;

    // Keep this probe "simple" (no auth, no JSON Content-Type) to avoid unnecessary
    // CORS preflights and make failures easier to debug.
    try {
      const response = await fetch(resolveApiUrl("/health"), {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok && (data as any)?.status === "ok") {
        return { data: { status: "ok" } };
      }

      primaryError =
        typeof (data as any)?.error === "string"
          ? (data as any).error
          : `HTTP ${response.status}: Health check failed`;
    } catch (error) {
      primaryError = error instanceof Error ? error.message : "Network error";
    }

    // Fallback for environments still running older backend builds without /health.
    try {
      const probe = await fetch(resolveApiUrl("/protected/me"), {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const contentType = probe.headers.get("content-type") || "";

      // 401 JSON means backend auth middleware responded correctly.
      if ((probe.status === 401 || probe.status === 200) && contentType.includes("application/json")) {
        return { data: { status: "ok" } };
      }
    } catch {
      // continue to next fallback
    }

    try {
      const root = await fetch(resolveApiUrl("/"), { method: "GET" });
      const text = await root.text();
      if (root.ok && text.includes("White Market backend is running")) {
        return { data: { status: "ok" } };
      }
    } catch {
      // swallow and return primary failure
    }

    return { error: primaryError || "Backend health check failed" };
  },
};

// ==================== BOOKS AND NOTES API ====================

export interface BooksAndNotesItem {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  // Book specific fields
  isbn?: string;
  author?: string;
  edition?: string;
  publisher?: string;
  // Categorization
  book_type: string;
  subject?: string;
  course_code?: string;
  academic_level?: string;
  // Condition and pricing
  condition: string;
  price: number;
  price_negotiable: boolean;
  // Details
  page_count?: number;
  language?: string;
  location?: string;
  images?: string[];
  // Status
  is_active: boolean;
  is_sold: boolean;
  // Stats
  view_count: number;
  rating: number;
  review_count: number;
  created_at: string;
  updated_at: string;
  seller?: {
    id: string;
    full_name: string;
    avatar_url?: string;
    campus?: string;
    role: string;
  };
  reviews?: {
    id: string;
    rating: number;
    comment?: string;
    created_at: string;
    reviewer?: {
      id: string;
      full_name: string;
      avatar_url?: string;
    };
  }[];
}

export const booksApi = {
  // Get all books and notes with filters
  getAll: async (
    book_type?: string,
    subject?: string,
    course_code?: string,
    academic_level?: string,
    condition?: string,
    min_price?: number,
    max_price?: number,
    search?: string,
    limit = 20,
    offset = 0,
    sort = 'newest'
  ): Promise<ApiResponse<BooksAndNotesItem[]>> => {
    const params = new URLSearchParams();
    if (book_type) params.append('book_type', book_type);
    if (subject) params.append('subject', subject);
    if (course_code) params.append('course_code', course_code);
    if (academic_level) params.append('academic_level', academic_level);
    if (condition) params.append('condition', condition);
    if (min_price) params.append('min_price', min_price.toString());
    if (max_price) params.append('max_price', max_price.toString());
    if (search) params.append('search', search);
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());
    params.append('sort', sort);
    return fetchApi(`/books?${params.toString()}`);
  },

  // Get by ID
  getById: async (id: string): Promise<ApiResponse<BooksAndNotesItem>> => {
    return fetchApi(`/books/${id}`);
  },

  // Get book types
  getTypes: async (): Promise<ApiResponse<string[]>> => {
    return fetchApi('/books/meta/types');
  },

  // Get subjects
  getSubjects: async (): Promise<ApiResponse<string[]>> => {
    return fetchApi('/books/meta/subjects');
  },

  // Create listing
  create: async (data: {
    title: string;
    description?: string;
    isbn?: string;
    author?: string;
    edition?: string;
    publisher?: string;
    book_type: string;
    subject?: string;
    course_code?: string;
    academic_level?: string;
    condition: string;
    price: number;
    price_negotiable?: boolean;
    page_count?: number;
    language?: string;
    location?: string;
    images?: string[];
  }): Promise<ApiResponse<BooksAndNotesItem>> => {
    return fetchApi('/books', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Update listing
  update: async (
    id: string,
    data: Partial<{
      title: string;
      description: string;
      isbn: string;
      author: string;
      edition: string;
      book_type: string;
      subject: string;
      course_code: string;
      academic_level: string;
      condition: string;
      price: number;
      price_negotiable: boolean;
      location: string;
      images: string[];
    }>
  ): Promise<ApiResponse<BooksAndNotesItem>> => {
    return fetchApi(`/books/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Delete listing
  delete: async (id: string): Promise<ApiResponse<{ success: boolean }>> => {
    return fetchApi(`/books/${id}`, {
      method: 'DELETE',
    });
  },

  // Mark as sold
  markAsSold: async (id: string): Promise<ApiResponse<BooksAndNotesItem>> => {
    return fetchApi(`/books/${id}/sold`, {
      method: 'POST',
    });
  },

  // Create review
  createReview: async (
    id: string,
    data: { rating: number; comment?: string }
  ): Promise<ApiResponse<any>> => {
    return fetchApi(`/books/${id}/reviews`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Get user's books
  getUserBooks: async (userId: string, limit = 20, offset = 0): Promise<ApiResponse<BooksAndNotesItem[]>> => {
    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());
    return fetchApi(`/books/user/${userId}?${params.toString()}`);
  },
};

// ==================== FASHION API ====================

export interface FashionItem {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  // Fashion specific fields
  category: string;
  gender: string;
  size?: string;
  color?: string;
  brand?: string;
  material?: string;
  pattern?: string;
  // Condition
  condition: string;
  // Pricing
  price: number;
  price_negotiable: boolean;
  original_price?: number;
  // Details
  location?: string;
  images?: string[];
  // Status
  is_active: boolean;
  is_sold: boolean;
  // Stats
  view_count: number;
  rating: number;
  review_count: number;
  created_at: string;
  updated_at: string;
  seller?: {
    id: string;
    full_name: string;
    avatar_url?: string;
    campus?: string;
    role: string;
  };
  reviews?: {
    id: string;
    rating: number;
    comment?: string;
    created_at: string;
    reviewer?: {
      id: string;
      full_name: string;
      avatar_url?: string;
    };
  }[];
}

export interface FashionFilters {
  sizes: string[];
  colors: string[];
  conditions: string[];
  brands: string[];
  genders: string[];
}

export const fashionApi = {
  // Get all fashion items with filters
  getAll: async (
    category?: string,
    size?: string,
    color?: string,
    brand?: string,
    condition?: string,
    gender?: string,
    limit = 20,
    offset = 0,
    sort = 'rating'
  ): Promise<ApiResponse<FashionItem[]>> => {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (size) params.append('size', size);
    if (color) params.append('color', color);
    if (brand) params.append('brand', brand);
    if (condition) params.append('condition', condition);
    if (gender) params.append('gender', gender);
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());
    params.append('sort', sort);
    return fetchApi(`/fashion?${params.toString()}`);
  },

  // Get by ID
  getById: async (id: string): Promise<ApiResponse<FashionItem>> => {
    return fetchApi(`/fashion/${id}`);
  },

  // Get categories
  getCategories: async (): Promise<ApiResponse<string[]>> => {
    return fetchApi('/fashion/meta/categories');
  },

  // Get available filters
  getFilters: async (): Promise<ApiResponse<FashionFilters>> => {
    return fetchApi('/fashion/meta/filters');
  },

  // Create listing
  create: async (data: {
    title: string;
    description?: string;
    price: number;
    price_type?: 'fixed' | 'hourly' | 'from';
    location?: string;
    size?: string;
    color?: string;
    brand?: string;
    condition?: string;
    gender?: string;
    images?: string[];
  }): Promise<ApiResponse<{ service: FashionItem }>> => {
    return fetchApi('/fashion', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Update listing
  update: async (
    id: string,
    data: Partial<{
      title: string;
      description: string;
      price: number;
      price_type: 'fixed' | 'hourly' | 'from';
      location: string;
      size: string;
      color: string;
      brand: string;
      condition: string;
      gender: string;
      images: string[];
    }>
  ): Promise<ApiResponse<{ service: FashionItem }>> => {
    return fetchApi(`/fashion/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Delete listing
  delete: async (id: string): Promise<ApiResponse<{ success: boolean }>> => {
    return fetchApi(`/fashion/${id}`, {
      method: 'DELETE',
    });
  },

  // Toggle active status
  toggle: async (id: string): Promise<ApiResponse<{ service: FashionItem }>> => {
    return fetchApi(`/fashion/${id}/toggle`, {
      method: 'PATCH',
    });
  },

  // Create review
  createReview: async (
    id: string,
    data: { rating: number; comment?: string }
  ): Promise<ApiResponse<any>> => {
    return fetchApi(`/fashion/${id}/reviews`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Mark as sold
  markAsSold: async (id: string): Promise<ApiResponse<FashionItem>> => {
    return fetchApi(`/fashion/${id}/sold`, {
      method: 'POST',
    });
  },

  // Get user's fashion items
  getUserFashion: async (userId: string, limit = 20, offset = 0): Promise<ApiResponse<FashionItem[]>> => {
    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());
    return fetchApi(`/fashion/user/${userId}?${params.toString()}`);
  },

  // Get brands
  getBrands: async (): Promise<ApiResponse<string[]>> => {
    return fetchApi('/fashion/meta/brands');
  },
};

// Ratings API
export const ratingsApi = {
  // Get seller rating stats
  getSellerStats: async (sellerId: string): Promise<ApiResponse<any>> => {
    return fetchApi(`/ratings/seller/${sellerId}/stats`);
  },

  // Get ratings for a seller
  getSellerRatings: async (
    sellerId: string,
    page = 1,
    limit = 10,
    sort = 'recent'
  ): Promise<ApiResponse<any>> => {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    params.append('sort', sort);
    return fetchApi(`/ratings/seller/${sellerId}?${params.toString()}`);
  },

  // Get rating for a specific order
  getOrderRating: async (orderId: string): Promise<ApiResponse<any>> => {
    return fetchApi(`/ratings/order/${orderId}`);
  },

  // Submit a new rating
  submitRating: async (data: {
    order_id: string;
    seller_id: string;
    overall_rating: number;
    product_quality_rating?: number;
    communication_rating?: number;
    delivery_speed_rating?: number;
    packaging_rating?: number;
    value_for_money_rating?: number;
    review_text?: string;
    review_title?: string;
    feedback_tags?: string[];
    review_photos?: string[];
    is_anonymous?: boolean;
  }): Promise<ApiResponse<any>> => {
    return fetchApi('/ratings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Update an existing rating
  updateRating: async (
    ratingId: string,
    data: {
      overall_rating?: number;
      product_quality_rating?: number;
      communication_rating?: number;
      delivery_speed_rating?: number;
      packaging_rating?: number;
      value_for_money_rating?: number;
      review_text?: string;
      review_title?: string;
      feedback_tags?: string[];
      review_photos?: string[];
      is_anonymous?: boolean;
    }
  ): Promise<ApiResponse<any>> => {
    return fetchApi(`/ratings/${ratingId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Add seller response to a rating
  addSellerResponse: async (
    ratingId: string,
    response: string
  ): Promise<ApiResponse<any>> => {
    return fetchApi(`/ratings/${ratingId}/response`, {
      method: 'POST',
      body: JSON.stringify({ response }),
    });
  },

  // Vote on rating helpfulness
  voteHelpful: async (
    ratingId: string,
    isHelpful: boolean
  ): Promise<ApiResponse<any>> => {
    return fetchApi(`/ratings/${ratingId}/helpful`, {
      method: 'POST',
      body: JSON.stringify({ is_helpful: isHelpful }),
    });
  },

  // Get user's rating history
  getUserHistory: async (
    page = 1,
    limit = 10
  ): Promise<ApiResponse<any>> => {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    return fetchApi(`/ratings/user/history?${params.toString()}`);
  },

  // Get orders eligible for rating
  getEligibleOrders: async (): Promise<ApiResponse<any>> => {
    return fetchApi('/ratings/eligible-orders');
  },

  // Get product rating stats
  getProductStats: async (productId: string): Promise<ApiResponse<any>> => {
    return fetchApi(`/ratings/product/${productId}/stats`);
  },

  // Get ratings for a product
  getProductRatings: async (
    productId: string,
    page = 1,
    limit = 10,
    sort = 'recent'
  ): Promise<ApiResponse<any>> => {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    params.append('sort', sort);
    return fetchApi(`/ratings/product/${productId}?${params.toString()}`);
  },

  // Submit a product rating
  createProductRating: async (data: {
    product_id: string;
    rating: number;
    comment?: string;
  }): Promise<ApiResponse<any>> => {
    return fetchApi('/ratings/product', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// Website Feedback API
export const feedbackApi = {
  // Submit website feedback
  submitFeedback: async (data: {
    rating: number;
    feedback_type?: string;
    feedback_text?: string;
    would_recommend?: boolean;
    improved_features?: string[];
    is_satisfied?: boolean;
    page_url?: string;
    session_duration_seconds?: number;
  }): Promise<ApiResponse<any>> => {
    return fetchApi('/feedback', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Get top testimonials for home page
  getTestimonials: async (limit = 3): Promise<ApiResponse<any>> => {
    return fetchApi(`/feedback/testimonials?limit=${limit}`);
  },

  // Get feedback stats
  getStats: async (): Promise<ApiResponse<any>> => {
    return fetchApi('/feedback/stats');
  },

  // Get all feedback (admin only)
  getAll: async (page = 1, limit = 20): Promise<ApiResponse<any>> => {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    return fetchApi(`/feedback?${params.toString()}`);
  },

  // Get single feedback (admin only)
  getById: async (feedbackId: string): Promise<ApiResponse<any>> => {
    return fetchApi(`/feedback/${feedbackId}`);
  },
};
