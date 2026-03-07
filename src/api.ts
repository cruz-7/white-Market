/**
 * API Service Layer
 * Connects frontend to the Express backend
 * Base URL:
 * - Dev default: http://localhost:5000
 * - Production default: relative paths (same origin/reverse proxy)
 */

const API_BASE_URL =
  import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:5000" : "");

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
  
  // Get token from localStorage
  const userJson = localStorage.getItem("wm_user");
  let token: string | null = null;
  if (userJson) {
    try {
      token = JSON.parse(userJson).access_token || null;
    } catch {
      token = null;
    }
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
};

// ==================== PRODUCTS API ====================

export interface Product {
  id: string;
  seller_id: string;
  title: string;
  description?: string;
  price: number;
  image_url?: string;
  category?: string;
  is_active?: boolean;
  created_at?: string;
  users?: {
    full_name: string;
    email: string;
  };
}

export const productsApi = {
  getAll: (query?: string) => {
    const endpoint = query ? `/products?q=${encodeURIComponent(query)}` : "/products";
    return fetchApi<Product[]>(endpoint);
  },

  getBySeller: (sellerId: string) =>
    fetchApi<Product[]>(`/products/seller/${sellerId}`),

  create: (product: { title: string; description?: string; price: number; image_url?: string }) =>
    fetchApi<{ message: string }>("/products", {
      method: "POST",
      body: JSON.stringify(product),
    }),

  delete: (id: string) =>
    fetchApi<{ message: string }>(`/products/${id}`, {
      method: "DELETE",
    }),

  uploadImage: async (file: File): Promise<ApiResponse<{ image_url: string }>> => {
    const formData = new FormData();
    formData.append("image", file);

    const userJson = localStorage.getItem("wm_user");
    const token = userJson ? JSON.parse(userJson).access_token : null;

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
  status: "pending" | "paid" | "cancelled";
  created_at: string;
  paid_at?: string;
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

// ==================== ADMIN API ====================

export type AdminUserRole = "user" | "seller" | "admin" | "banned";

export interface AdminUser {
  id: string;
  full_name?: string | null;
  email: string;
  role: AdminUserRole;
  created_at?: string;
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
};

// ==================== UTILITY ====================

export function isApiConfigured(): boolean {
  return Boolean(import.meta.env.VITE_API_URL || import.meta.env.DEV);
}

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

export const healthApi = {
  check: async (): Promise<ApiResponse<{ status: string }>> => {
    const primary = await fetchApi<{ status?: string }>("/health");
    if (primary.data?.status === "ok") {
      return { data: { status: "ok" } };
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

    return { error: primary.error || "Backend health check failed" };
  },
};
