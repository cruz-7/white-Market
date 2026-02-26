/**
 * API Service Layer
 * Connects frontend to the Express backend
 * Base URL: http://localhost:5000
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

interface ApiResponse<T = any> {
  data?: T;
  error?: string;
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // Get token from localStorage
  const userJson = localStorage.getItem("wm_user");
  const token = userJson ? JSON.parse(userJson).access_token : null;
  
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

    const data = await response.json();

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
  status: "pending" | "paid" | "cancelled";
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

  verify: (reference: string) =>
    fetchApi<{ message: string; order_id: string }>(`/payments/verify/${reference}`),
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
    fetchApi<UserProfile>("/profile"),

  updateProfile: (data: Partial<UserProfile>) =>
    fetchApi<{ message: string }>("/profile", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  getWallet: () =>
    fetchApi<{ balance: number; pending_earnings: number }>("/wallet"),

  topUp: (amount: number) =>
    fetchApi<{ message: string }>("/wallet/topup", {
      method: "POST",
      body: JSON.stringify({ amount }),
    }),

  withdraw: (amount: number, momo_number?: string) =>
    fetchApi<{ message: string }>("/wallet/withdraw", {
      method: "POST",
      body: JSON.stringify({ amount, momo_number }),
    }),

  getTransactions: () =>
    fetchApi<any[]>("/wallet/transactions"),
};

// ==================== ADMIN API ====================

export const adminApi = {
  getAllUsers: () =>
    fetchApi<UserProfile[]>("/admin/users"),

  updateUserRole: (userId: string, role: string) =>
    fetchApi<{ message: string }>(`/admin/users/${userId}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }),

  getStats: () =>
    fetchApi<{
      totalUsers: number;
      totalOrders: number;
      totalRevenue: number;
    }>("/admin/stats"),
};

// ==================== UTILITY ====================

export function isApiConfigured(): boolean {
  return true;
}

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}
