/**
 * API Service Layer
 *
 * Talks to the Convex backend through the Convex React client. Every helper
 * keeps the `{ data?, error? }` contract the UI already relies on, so calling
 * code does not need to change when a request fails.
 */

import { api as generatedApi } from "../convex/_generated/api";
import { convex, convexAccessToken, getConvexAuthBridge } from "./convex-client";
const api = generatedApi.functions;

const CONVEX_SITE_URL = String(
  import.meta.env.VITE_CONVEX_SITE_URL || import.meta.env.VITE_CONVEX_URL || ""
).replace(/\/+$/, "");

interface ApiResponse<T = any> {
  data?: T;
  error?: string;
}

function toMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return "Request failed";
}

/** Runs a Convex call and normalises it to the `{ data?, error? }` shape. */
async function run<T>(operation: () => Promise<T>): Promise<ApiResponse<T>> {
  try {
    return { data: await operation() };
  } catch (error) {
    console.error("[api]", error);
    return { error: toMessage(error) };
  }
}

/** Uploads an image to Convex file storage and returns its public URL. */
async function uploadImage(
  file: File,
  endpoint = "/upload"
): Promise<ApiResponse<{ image_url: string }>> {
  const token = convexAccessToken();
  if (!token) {
    return { error: "You must be signed in to upload images" };
  }
  if (!CONVEX_SITE_URL) {
    return { error: "VITE_CONVEX_SITE_URL is not configured" };
  }

  try {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${CONVEX_SITE_URL}${endpoint}`, {
      method: "POST",
        headers: { Authorization: `Bearer ${convexAccessToken()}` },
      body: formData,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { error: (data as { error?: string }).error || "Upload failed" };
    }
    return { data: data as { image_url: string } };
  } catch (error) {
    return { error: toMessage(error) };
  }
}

async function uploadRiderApplication(data: {
  legal_name: string;
  phone: string;
  student_id_number: string;
  document: File;
}): Promise<ApiResponse<{ id: string; status: string }>> {
  const token = convexAccessToken();
  if (!token) return { error: "You must be signed in to apply" };
  if (!CONVEX_SITE_URL) return { error: "VITE_CONVEX_SITE_URL is not configured" };
  try {
    const formData = new FormData();
    formData.append("legal_name", data.legal_name);
    formData.append("phone", data.phone);
    formData.append("student_id_number", data.student_id_number);
    formData.append("document", data.document);
    const response = await fetch(`${CONVEX_SITE_URL}/rider-application-upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const result = await response.json().catch(() => ({})) as { id?: string; status?: string; error?: string };
    if (!response.ok) return { error: result.error || "Rider application upload failed" };
    if (!result.id || !result.status) return { error: "Rider application response was incomplete" };
    return { data: { id: result.id, status: result.status } };
  } catch (error) {
    return { error: toMessage(error) };
  }
}

// ==================== AUTH API ====================

export interface AuthSignupParams {
  email: string;
  password: string;
  full_name: string;
  role?: "user" | "seller";
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

const RESET_EMAIL_KEY = "wm_reset_email";

export const authApi = {
  signup: (params: AuthSignupParams) =>
    run(async () => {
      const bridge = getConvexAuthBridge();
      const result = await bridge.signIn("password", {
        email: params.email.trim().toLowerCase(),
        password: params.password,
        full_name: params.full_name?.trim(),
        name: params.full_name?.trim(),
        role: params.role ?? "user",
        flow: "signUp",
      });
      bridge.refreshClientAuth();

      const profile = await accountApi.me();
      return {
        message: "Account created",
        signingIn: result.signingIn,
        user: profile.data?.user,
      };
    }),

  login: (params: AuthLoginParams) =>
    run(async () => {
      const bridge = getConvexAuthBridge();
      const result = await bridge.signIn("password", {
        email: params.email.trim().toLowerCase(),
        password: params.password,
        flow: "signIn",
      });
      bridge.refreshClientAuth();

      const profile = await accountApi.me();
      return {
        message: "Signed in",
        signingIn: result.signingIn,
        user: profile.data?.user,
      };
    }),

  signOut: () =>
    run(async () => {
      const bridge = getConvexAuthBridge();
      await bridge.signOut();
      localStorage.removeItem("wm_user");
      window.dispatchEvent(new Event("wm-auth-change"));
      return { message: "Signed out" };
    }),

  confirmEmail: (email: string) =>
    run(() =>
      convex.mutation(api.account.confirmEmail, { email: email.trim().toLowerCase() })
    ) as Promise<ApiResponse<{ message: string; user_id?: string; status: string }>>,

  forgotPassword: (email: string) =>
    run(async () => {
      const normalized = email.trim().toLowerCase();
      localStorage.setItem(RESET_EMAIL_KEY, normalized);
      await convex.action(generatedApi.auth.signIn, {
        provider: "password",
        params: {
          email: normalized,
          flow: "reset",
          redirectTo: "/reset-password",
        },
      });
      return { message: "Password reset link sent" };
    }),

  resetPassword: (code: string, password: string, email?: string) =>
    run(async () => {
      const normalizedEmail = (
        email ?? localStorage.getItem(RESET_EMAIL_KEY) ?? ""
      ).trim().toLowerCase();
      if (!normalizedEmail) {
        throw new Error("This reset link is missing the account email. Request a new one.");
      }

      await convex.action(generatedApi.auth.signIn, {
        provider: "password",
        params: {
          email: normalizedEmail,
          code,
          newPassword: password,
          flow: "reset-verification",
        },
      });

      localStorage.removeItem(RESET_EMAIL_KEY);
      return { message: "Password reset successfully" };
    }),

  changePassword: (current_password: string, new_password: string) =>
    run(() =>
      convex.action(api.account.changePassword, { current_password, new_password })
    ) as Promise<ApiResponse<{ message: string; user?: { id: string; email: string } }>>,

  verifyResetToken: (code: string) =>
    Promise.resolve<ApiResponse<{ valid: boolean; user_id?: string; error?: string }>>(
      code ? { data: { valid: true } } : { error: "Invalid reset token" }
    ),
};

// ==================== ACCOUNT API ====================

export interface AccountUser {
  id: string;
  email: string;
  role: string;
  full_name: string;
  verified: boolean;
  avatar_url: string | null;
}

export const accountApi = {
  /** The signed-in user's own identity. */
  me: () =>
    run(() => convex.query(api.account.me)) as Promise<
      ApiResponse<{ message: string; user: AccountUser }>
    >,
};

// ==================== PRODUCTS API ====================

export interface Product {
  id: string;
  seller_id: string;
  title: string;
  description?: string;
  price: number;
  image_url?: string;
  condition?: string;
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
    const normalized = typeof params === "string" ? { q: params } : params ?? {};
    return run(() =>
      convex.query(api.products.list, {
        q: normalized.q,
        category_id: normalized.category_id as any,
        min_price: normalized.min_price,
        max_price: normalized.max_price,
        sort: normalized.sort,
        page: normalized.page,
        limit: normalized.limit,
        seller_id: normalized.seller_id as any,
        is_active: normalized.is_active,
      })
    ) as Promise<ApiResponse<Product[]>>;
  },

  getById: (id: string) =>
    run(() => convex.query(api.products.get, { id: id as any })) as Promise<ApiResponse<Product>>,

  getBySeller: (sellerId: string) =>
    run(() =>
      convex.query(api.products.bySeller, { sellerId: sellerId as any })
    ) as Promise<ApiResponse<Product[]>>,

  // Get trending products
  getTrending: (limit = 10) =>
    run(() => convex.query(api.products.trending, { limit })) as Promise<ApiResponse<Product[]>>,

  // Track product view
  trackView: (productId: string) =>
    run(() => convex.mutation(api.products.recordView, { id: productId as any })),

  // Track product click
  trackClick: (productId: string) =>
    run(() => convex.mutation(api.products.recordClick, { id: productId as any })),

  create: (product: {
    title: string;
    description?: string;
    price: number;
    image_url?: string;
    category_id?: string;
    condition?: string;
    campus?: string;
    stock_quantity?: number;
    negotiable?: boolean;
  }) =>
    run(() =>
      convex.mutation(api.products.create, {
        title: product.title,
        description: product.description,
        price: product.price,
        image_url: product.image_url,
        category_id: product.category_id as any,
        condition: product.condition,
        campus: product.campus,
        stock_quantity: product.stock_quantity,
        negotiable: product.negotiable,
      })
    ),

  update: (
    id: string,
    product: {
      title?: string;
      description?: string;
      price?: number;
      image_url?: string;
      category_id?: string;
      is_active?: boolean;
      stock_quantity?: number;
      condition?: string;
      negotiable?: boolean;
    }
  ) =>
    run(() =>
      convex.mutation(api.products.update, {
        id: id as any,
        title: product.title,
        description: product.description,
        price: product.price,
        image_url: product.image_url,
        category_id: product.category_id as any,
        is_active: product.is_active,
        stock_quantity: product.stock_quantity,
        condition: product.condition,
        negotiable: product.negotiable,
      })
    ),

  delete: (id: string) =>
    run(() => convex.mutation(api.products.remove, { id: id as any })),

  recordView: (id: string) =>
    run(() => convex.mutation(api.products.recordView, { id: id as any })),

  uploadImage: (file: File): Promise<ApiResponse<{ image_url: string }>> =>
    uploadImage(file),
};

// ==================== ORDERS API ====================

export interface Order {
  id: string;
  product_id?: string;
  fashion_id?: string;
  buyer_id: string;
  seller_id: string;
  amount: number;
  item_amount?: number;
  delivery_fee?: number;
  delivery_method?: string;
  delivery_status?: string;
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
  product_id?: string;
  fashion_id?: string;
}

export interface UpdateOrderStatusParams {
  status: "cancelled";
}

export const ordersApi = {
  create: (params: CreateOrderParams) =>
    run(() =>
      convex.mutation(api.orders.create, {
        product_id: params.product_id as any,
        fashion_id: params.fashion_id as any,
      })
    ),

  getMyOrders: () =>
    run(() => convex.query(api.orders.myOrders)) as Promise<ApiResponse<Order[]>>,

  getSales: () =>
    run(() => convex.query(api.orders.sales)) as Promise<ApiResponse<Order[]>>,

  getById: (id: string) =>
    run(() =>
      convex.query(api.orders.get, { id: id as any })
    ) as Promise<ApiResponse<Order & { buyer?: { full_name?: string }; seller?: { full_name?: string } }>>,

  updateStatus: (id: string, params: UpdateOrderStatusParams) =>
    run(() => convex.mutation(api.orders.updateStatus, { id: id as any, status: params.status })),

  completeOrder: (id: string) =>
    run(() => convex.mutation(api.orders.complete, { id: id as any })),

  createDispute: (id: string, reason: string, description?: string) =>
    run(() =>
      convex.mutation(api.orders.createDispute, {
        id: id as any,
        reason,
        description,
      })
    ),

  getDispute: (id: string) =>
    run(() => convex.query(api.orders.getDispute, { id: id as any })),
};

export interface DeliveryLocation {
  id: string;
  name: string;
  category: string;
}

export interface DeliveryZone {
  id: string;
  name: string;
  fee: number;
  configured: boolean;
}

export interface DeliveryJob {
  id: string;
  order_id: string;
  destination_name: string;
  zone_name: string;
  meeting_point: string;
  delivery_fee: number;
  item_name: string;
}

export interface DeliveryRecord {
  id: string;
  order_id: string;
  buyer_id: string;
  seller_id: string;
  rider_id?: string;
  destination_name?: string;
  zone_name?: string;
  meeting_point?: string;
  delivery_fee: number;
  status: string;
  product_name: string;
  events: { event: string; note?: string; at?: string }[];
}

export const deliveryApi = {
  publicOptions: () =>
    run(() => convex.query(api.delivery.publicOptions, {})),
  setDeliveryOption: (params: {
    order_id: string;
    method: "campus_pickup" | "delivery";
    destination_id?: string;
    zone_id?: string;
    meeting_point?: string;
  }) => run(() => convex.mutation(api.delivery.setDeliveryOption, {
    order_id: params.order_id as any,
    method: params.method,
    destination_id: params.destination_id as any,
    zone_id: params.zone_id as any,
    meeting_point: params.meeting_point,
  })),
  buyerDeliveryOption: (orderId: string) =>
    run(() => convex.query(api.delivery.buyerDeliveryOption, { order_id: orderId as any })),
  submitRiderApplication: uploadRiderApplication,
  myRiderApplication: () => run(() => convex.query(api.delivery.myRiderApplication, {})),
  availableJobs: () => run(() => convex.query(api.delivery.availableJobs, {})),
  myDeliveries: () => run(() => convex.query(api.delivery.myDeliveries, {})),
  acceptJob: (id: string) => run(() => convex.mutation(api.delivery.acceptJob, { id: id as any })),
  confirmPickup: (id: string) => run(() => convex.mutation(api.delivery.confirmPickup, { id: id as any })),
  updateJobStatus: (id: string, status: string, note?: string) =>
    run(() => convex.mutation(api.delivery.updateJobStatus, { id: id as any, status, note })),
  confirmReceipt: (id: string) => run(() => convex.mutation(api.delivery.confirmReceipt, { id: id as any })),
  createComplaint: (id: string, reason: string, details: string) =>
    run(() => convex.mutation(api.delivery.createComplaint, { id: id as any, reason, details })),
  initializeAdminDefaults: () => run(() => convex.mutation(api.delivery.ensureDefaults, {})),
  adminConfiguration: () => run(() => convex.query(api.delivery.adminConfiguration, {})),
  adminRiderApplications: (status = "pending") =>
    run(() => convex.query(api.delivery.adminRiderApplications, { status })),
  reviewRiderApplication: (id: string, action: string, reason?: string) =>
    run(() => convex.mutation(api.delivery.reviewRiderApplication, { id: id as any, action, reason })),
  setZoneFee: (
    id: string, fee: number, rider_compensation: number, transport_cost: number,
    confirmed_tested: boolean, is_active?: boolean,
  ) => run(() => convex.mutation(api.delivery.setZoneFee, {
    id: id as any, fee, rider_compensation, transport_cost, confirmed_tested, is_active,
  })),
  setLocation: (params: { id?: string; name: string; category: string; is_active: boolean }) =>
    run(() => convex.mutation(api.delivery.setLocation, { ...params, id: params.id as any })),
  adminDeliveries: () => run(() => convex.query(api.delivery.adminDeliveries, {})),
  adminComplaints: () => run(() => convex.query(api.delivery.adminComplaints, {})),
  resolveComplaint: (id: string, resolution: string, suspend_rider?: boolean) =>
    run(() => convex.mutation(api.delivery.resolveComplaint, { id: id as any, resolution, suspend_rider })),
  downloadRiderDocument: async (id: string): Promise<ApiResponse<Blob>> => {
    const token = convexAccessToken();
    if (!token) return { error: "Sign in before reviewing rider documents" };
    if (!CONVEX_SITE_URL) return { error: "VITE_CONVEX_SITE_URL is not configured" };
    try {
      const response = await fetch(`${CONVEX_SITE_URL}/rider-application-document/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return { error: await response.text() || "Could not load rider document" };
      return { data: await response.blob() };
    } catch (error) {
      return { error: toMessage(error) };
    }
  },
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
    run(() =>
      convex.action(api.payments.initialize, {
        order_id: params.order_id as any,
        callback_url: params.callback_url,
      })
    ) as Promise<ApiResponse<PaymentResponse>>,

  walletPay: (order_id: string) =>
    run(() => convex.mutation(api.payments.walletPay, { order_id: order_id as any })),

  verify: (reference: string) =>
    run(() => convex.action(api.payments.verify, { reference })),
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
  receiver_id?: string;
  text?: string | null;
  image_url?: string | null;
  created_at: string;
  status: "sent" | "delivered" | "read";
}

export const messagesApi = {
  getConversations: () =>
    run(() => convex.query(api.messages.conversations)) as Promise<
      ApiResponse<{ conversations: Conversation[] }>
    >,

  upsertConversation: (params: { product_id: string; buyer_id?: string }) =>
    run(() =>
      convex.mutation(api.messages.upsert, {
        product_id: params.product_id as any,
        buyer_id: params.buyer_id as any,
      })
    ),

  getConversationMessages: (conversationId: string) =>
    run(() =>
      convex.query(api.messages.messages, { conversationId: conversationId as any })
    ) as Promise<ApiResponse<{ messages: ChatMessage[] }>>,

  sendMessage: (params: { conversation_id: string; text?: string; image_url?: string }) =>
    run(() =>
      convex.mutation(api.messages.send, {
        conversation_id: params.conversation_id as any,
        text: params.text,
        image_url: params.image_url,
      })
    ),

  markRead: (conversation_id: string) =>
    run(() => convex.mutation(api.messages.markRead, { conversation_id: conversation_id as any })),
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
    run(() => convex.query(api.profile.get)) as Promise<ApiResponse<UserProfile>>,

  updateProfile: (data: Partial<UserProfile> & { momo_provider?: string; seller_bio?: string }) =>
    run(() =>
      convex.mutation(api.profile.update, {
        full_name: data.full_name,
        avatar_url: data.avatar_url,
        momo_number: data.momo_number,
        momo_provider: data.momo_provider,
        campus: data.campus,
        whatsapp: data.whatsapp,
        seller_bio: data.seller_bio,
        role: data.role,
      })
    ),

  deleteMyAccount: () =>
    run(() => convex.mutation(api.profile.deleteMyAccount, {})),

  getWallet: () =>
    run(() =>
      convex.query(api.wallet.summary)
    ) as Promise<ApiResponse<{ balance: number; pending_earnings: number }>>,

  topUp: (amount: number) =>
    run(() => convex.mutation(api.wallet.topUp, { amount })),

  withdraw: (amount: number, momo_number?: string) =>
    run(() => convex.mutation(api.wallet.withdraw, { amount, momo_number })),

  getTransactions: () =>
    run(() => convex.query(api.wallet.recentTransactions)) as Promise<ApiResponse<any[]>>,
};

export const sellerApi = {
  getTopSellers: (limit = 3) =>
    run(() => convex.query(api.sellers.top, { limit })) as Promise<
      ApiResponse<{ sellers: any[]; count: number }>
    >,

  getProfile: () =>
    run(() => convex.query(api.profile.sellerProfile)) as Promise<
      ApiResponse<{
        id: string;
        full_name: string;
        seller_display_name?: string;
        seller_profile_image_url?: string;
        last_name_change?: string;
        can_change_name: boolean;
        days_remaining: number;
      }>
    >,

  updateProfile: (data: {
    seller_display_name?: string;
    seller_profile_image_url?: string;
    seller_bio?: string;
    seller_response_time?: string;
  }) =>
    run(() =>
      convex.mutation(api.profile.updateSellerProfile, {
        seller_display_name: data.seller_display_name,
        seller_profile_image_url: data.seller_profile_image_url,
        seller_bio: data.seller_bio,
        seller_response_time: data.seller_response_time,
      })
    ),

  uploadProfileImage: (file: File): Promise<ApiResponse<{ image_url: string }>> =>
    uploadImage(file),
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
  has_document?: boolean;
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
    run(() => convex.query(api.verification.status)) as Promise<ApiResponse<VerificationStatus>>,

  submitDocument: async (
    file: File,
    documentType: VerificationRequest["document_type"]
  ): Promise<ApiResponse<{ message: string; verification_id: string; status: string }>> => {
    const token = convexAccessToken();
    if (!token) return { error: "Sign in before submitting a verification document" };
    if (!CONVEX_SITE_URL) return { error: "VITE_CONVEX_SITE_URL is not configured" };

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("document_type", documentType);
      const response = await fetch(`${CONVEX_SITE_URL}/verification-upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const result = await response.json().catch(() => ({})) as {
        error?: string;
        message?: string;
        verification_id?: string;
        status?: string;
      };
      if (!response.ok) return { error: result.error || "Verification document upload failed" };
      return {
        data: {
          message: result.message ?? "Verification request submitted for review",
          verification_id: result.verification_id ?? "",
          status: result.status ?? "pending",
        },
      };
    } catch (error) {
      return { error: toMessage(error) };
    }
  },

  downloadDocument: async (id: string): Promise<ApiResponse<Blob>> => {
    const token = convexAccessToken();
    if (!token) return { error: "Sign in before viewing verification documents" };
    if (!CONVEX_SITE_URL) return { error: "VITE_CONVEX_SITE_URL is not configured" };

    try {
      const response = await fetch(
        `${CONVEX_SITE_URL}/verification-document/${encodeURIComponent(id)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) {
        return { error: (await response.text()) || "Could not load verification document" };
      }
      return { data: await response.blob() };
    } catch (error) {
      return { error: toMessage(error) };
    }
  },

  // Admin endpoints
  getAllPending: (status?: string) =>
    run(() =>
      convex.query(api.verification.listPending, { status })
    ) as Promise<ApiResponse<{ verifications: Verification[] }>>,

  approve: (id: string) =>
    run(() => convex.mutation(api.verification.approve, { id: id as any })),

  reject: (id: string, reason?: string) =>
    run(() => convex.mutation(api.verification.reject, { id: id as any, reason })),
};

// ==================== ADMIN API ====================

export type AdminUserRole = "user" | "seller" | "admin" | "banned";

export interface AdminUser {
  id: string;
  full_name?: string | null;
  email: string;
  role: AdminUserRole;
  verified?: boolean;
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
  commission?: number;
  status: string;
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

export interface AdminDispute {
  id: string;
  order_id: string;
  status: string;
  reason: string;
  description: string;
  resolution: string;
  created_at: string;
  resolved_at?: string | null;
  raised_by: { full_name: string; email: string };
  order: {
    amount: number;
    status: string;
    buyer_id: string;
    seller_id: string;
    product: string;
  } | null;
}

export interface AdminPayout {
  id: string;
  amount: number;
  net_amount: number;
  status: string;
  funds_reserved: boolean;
  momo_number: string | null;
  network: string | null;
  failure_reason: string | null;
  transfer_reference: string | null;
  created_at: string;
  processed_at?: string | null;
  seller: { id: string; full_name: string; email: string };
  order: { id: string; amount: number; status: string } | null;
}

export interface AdminSettings {
  commission_rate: number;
  min_withdrawal: number;
  withdrawal_percentage: number;
  payout_cooldown_hours: number;
}

export const adminApi = {
  getAllUsers: () =>
    run(() => convex.query(api.admin.users)) as Promise<ApiResponse<AdminUser[]>>,

  updateUserRole: (userId: string, role: AdminUserRole) =>
    run(() => convex.mutation(api.admin.setUserRole, { id: userId as any, role })),

  banUser: (userId: string) =>
    run(() => convex.mutation(api.admin.banUser, { id: userId as any })),

  unbanUser: (userId: string) =>
    run(() => convex.mutation(api.admin.unbanUser, { id: userId as any })),

  bulkUsers: (userIds: string[], action: "ban" | "unban") =>
    run(() =>
      convex.mutation(api.admin.bulkUsers, {
        userIds: userIds as any,
        action,
      })
    ),

  getAllProducts: () =>
    run(() => convex.query(api.admin.products)) as Promise<ApiResponse<AdminProduct[]>>,

  removeProduct: (productId: string) =>
    run(() => convex.mutation(api.products.adminRemove, { id: productId as any })),

  updateProduct: (productId: string, updates: { is_active?: boolean }) =>
    run(() =>
      convex.mutation(api.products.update, { id: productId as any, ...updates })
    ),

  bulkProducts: (productIds: string[], action: "approve" | "reject" | "delete") =>
    run(() =>
      convex.mutation(api.admin.bulkProducts, {
        productIds: productIds as any,
        action,
      })
    ),

  getAllOrders: () =>
    run(() => convex.query(api.admin.orders)) as Promise<ApiResponse<AdminOrder[]>>,

  getDisputes: () =>
    run(() => convex.query(api.admin.disputes)) as Promise<ApiResponse<AdminDispute[]>>,

  resolveDispute: (id: string, resolution: string) =>
    run(() =>
      convex.mutation(api.admin.resolveDispute, { id: id as any, resolution })
    ),

  getSettings: () =>
    run(() => convex.query(api.admin.adminSettings)) as Promise<ApiResponse<AdminSettings>>,

  updateSettings: (settings: AdminSettings) =>
    run(() => convex.mutation(api.admin.updateAdminSettings, settings)) as Promise<ApiResponse<AdminSettings>>,

  updateOrderStatus: (orderId: string, status: "pending" | "paid" | "cancelled") =>
    run(() => convex.mutation(api.admin.setOrderStatus, { id: orderId as any, status })),

  getStats: () =>
    run(() => convex.query(api.admin.stats)) as Promise<
      ApiResponse<{
        totalUsers: number;
        totalOrders: number;
        totalRevenue: number;
        totalProducts?: number;
        commission?: number;
      }>
    >,

  // Enhanced stats with more details
  getDashboardStats: () =>
    run(() => convex.query(api.admin.dashboardStats)) as Promise<
      ApiResponse<{
        users: { total: number; active: number; newToday: number; newThisWeek: number };
        orders: { total: number; pending: number; completed: number; cancelled: number; revenue: number };
        products: { total: number; active: number; pending: number };
        revenue: { total: number; thisMonth: number; lastMonth: number; averageOrder: number };
        referrals: { total: number; qualified: number; creditsIssued: number };
        growth: { userGrowth: number; orderGrowth: number; revenueGrowth: number };
      }>
    >,

  // System health
  getSystemHealth: () =>
    run(() => convex.query(api.admin.systemHealth)) as Promise<
      ApiResponse<{
        status: string;
        database: { connected: boolean; responseTime: number };
      }>
    >,

  // Get recent activity
  getRecentActivity: (limit = 20) =>
    run(() => convex.query(api.admin.activity, { limit })) as Promise<ApiResponse<any[]>>,

  // Get top sellers
  getTopSellers: (limit = 10) =>
    run(() => convex.query(api.admin.topSellers, { limit })) as Promise<ApiResponse<any[]>>,

  // Get revenue analytics
  getRevenueAnalytics: (period: "week" | "month" | "year" = "month") =>
    run(() =>
      convex.query(api.admin.revenueAnalytics, { period })
    ) as Promise<ApiResponse<{ daily: any[]; weekly: any[]; monthly: any[] }>>,

  // Get user analytics
  getUserAnalytics: () =>
    run(() =>
      convex.query(api.admin.userAnalytics)
    ) as Promise<ApiResponse<{ registrations: any[]; byRole: any; byVerification: any }>>,

  // Get financial stats
  getFinancialStats: () =>
    run(async () => {
      const [stats, settings] = await Promise.all([
        convex.query(api.wallet.platformStats),
        convex.query(api.wallet.settings),
      ]);
      return {
        ...stats,
        settings: {
          commission_rate: settings.commission_rate,
          min_withdrawal: settings.min_withdrawal,
          withdrawal_percentage: settings.withdrawal_percentage,
          payout_cooldown_hours: settings.payout_cooldown_hours,
        },
      };
    }),
};

export const adminPayoutsApi = {
  getAll: () =>
    run(() => convex.query(api.payouts.adminList)) as Promise<ApiResponse<AdminPayout[]>>,

  approve: (payoutId: string) =>
    run(() => convex.action(api.payouts.approve, { payout_id: payoutId as any })),

  reject: (payoutId: string, reason: string) =>
    run(() => convex.mutation(api.payouts.reject, { payout_id: payoutId as any, reason })),
};

export const servicesApiLegacy = {
  // Get all services with optional filters
  getAll: async (
    serviceType?: string,
    limit = 20,
    offset = 0,
    sort = "created_at.desc"
  ): Promise<ApiResponse<{ services: Service[]; total: number }>> => {
    const result = await run(() =>
      convex.query(api.services.list, {
        service_type: serviceType,
        limit,
        offset,
        sort,
      })
    );
    if (result.error || !result.data) return result as ApiResponse<any>;
    return { data: { services: result.data as Service[], total: (result.data as Service[]).length } };
  },

  // Get service by ID
  getById: async (id: string): Promise<ApiResponse<{ service: Service; reviews: ServiceReview[] }>> => {
    const result = await run(() => convex.query(api.services.byId, { id: id as any }));
    if (result.error || !result.data) return result as ApiResponse<any>;
    const { reviews, ...service } = result.data as any;
    return { data: { service: service as Service, reviews: (reviews ?? []) as ServiceReview[] } };
  },

  // Get service types with counts
  getTypes: async (): Promise<ApiResponse<ServiceType[]>> => {
    const result = await run(() => convex.query(api.services.metaTypes));
    if (result.error || !result.data) return result as ApiResponse<any>;
    return {
      data: (result.data as { type: string; count: number }[]).map((row) => ({
        id: row.type,
        name: row.type,
        icon: "",
        description: "",
        count: row.count,
      })),
    };
  },
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
    run(() => convex.query(api.sellers.me)) as unknown as Promise<ApiResponse<SellerStats>>,

  getById: (id: string) =>
    run(() =>
      convex.query(api.sellers.byId, { id: id as any })
    ) as unknown as Promise<ApiResponse<SellerPublicProfile>>,

  getAll: () =>
    run(() => convex.query(api.sellers.list)) as Promise<ApiResponse<{ sellers: any[] }>>,

  getTop: (limit = 6) =>
    run(() =>
      convex.query(api.sellers.top, { limit })
    ) as Promise<ApiResponse<{ sellers: any[]; count: number }>>,
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
    run(async () => {
      await convex.mutation(api.categories.ensureDefaults, {});
      return convex.query(api.categories.list);
    }) as unknown as Promise<ApiResponse<Category[]>>,

  getAllForAdmin: () =>
    run(() => convex.query(api.categories.listForAdmin)) as Promise<ApiResponse<Category[]>>,

  create: (data: { name: string }) =>
    run(() => convex.mutation(api.categories.create, data)),

  setActive: (id: string, is_active: boolean) =>
    run(() => convex.mutation(api.categories.setActive, { id: id as any, is_active })),

  getById: (id: string) =>
    run(() =>
      convex.query(api.categories.get, { id: id as any })
    ) as unknown as Promise<ApiResponse<{ category: Category; products: Product[]; pagination: any }>>,
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
    run(() =>
      convex.query(api.reviews.sellerReviews, {
        sellerId: sellerId as any,
        page,
        limit,
      })
    ) as Promise<
      ApiResponse<{ reviews: Review[]; rating: number; review_count: number; pagination: any }>
    >,

  getForOrder: (orderId: string) =>
    run(() =>
      convex.query(api.reviews.orderReview, { orderId: orderId as any })
    ) as Promise<ApiResponse<{ review: Review | null }>>,

  create: (review: {
    order_id: string;
    rating: number;
    comment?: string;
    is_seller_review?: boolean;
  }) =>
    run(() =>
      convex.mutation(api.reviews.create, {
        order_id: review.order_id as any,
        rating: review.rating,
        comment: review.comment,
        is_seller_review: review.is_seller_review,
      })
    ),

  update: (id: string, review: { rating?: number; comment?: string }) =>
    run(() =>
      convex.mutation(api.reviews.update, {
        id: id as any,
        rating: review.rating,
        comment: review.comment,
      })
    ),
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
    run(() => convex.query(api.favorites?.list)) as Promise<ApiResponse<{ favorites: Favorite[] }>>,

  add: (product_id: string) =>
    run(() => convex.mutation(api.favorites?.add, { product_id: product_id as any })),

  remove: (productId: string) =>
    run(() => convex.mutation(api.favorites?.remove, { product_id: productId as any })),

  check: (productId: string) =>
    run(() =>
      convex.query(api.favorites?.check, { product_id: productId as any })
    ) as Promise<ApiResponse<{ is_favorited: boolean }>>,
};

export const likesApi = {
  getLikeCount: (productId: string) =>
    run(() =>
      convex.query(api.favorites?.likeCount, { product_id: productId as any })
    ) as Promise<ApiResponse<{ like_count: number }>>,

  like: (productId: string) =>
    run(() =>
      convex.mutation(api.favorites?.like, { product_id: productId as any })
    ) as Promise<ApiResponse<{ like: any; like_count: number }>>,

  unlike: (productId: string) =>
    run(() =>
      convex.mutation(api.favorites?.unlike, { product_id: productId as any })
    ) as Promise<ApiResponse<{ message: string; like_count: number }>>,

  checkLike: (productId: string) =>
    run(() =>
      convex.query(api.favorites?.isLiked, { product_id: productId as any })
    ) as Promise<ApiResponse<{ is_liked: boolean }>>,
};

// ==================== SEARCH API ====================

export const searchApi = {
  saveQuery: (query: string) =>
    run(() => convex.mutation(api.search?.addHistory, { query })),

  getHistory: (limit = 10) =>
    run(() =>
      convex.query(api.search?.history, { limit })
    ) as Promise<ApiResponse<{ history: { query: string; created_at?: string }[] }>>,

  clearHistory: () =>
    run(() => convex.mutation(api.search?.clearHistory)),

  getSuggestions: (query: string, limit = 5) =>
    run(() =>
      convex.query(api.search?.suggestions, { q: query, limit })
    ) as Promise<
      ApiResponse<{ suggestions: { id: string; title: string; image_url: string }[]; popular: string[] }>
    >,

};

// ==================== REFERRALS API ====================

export interface ReferralStats {
  referral_code: string;
  referral_link?: string;
  total_referrals: number;
  recent_referrals?: { referred_id: string; created_at: string }[];
  qualified_buyer_referrals?: number;
  qualified_seller_referrals?: number;
  total_qualified?: number;
  platform_credit?: number;
  commission_discount_remaining?: number;
  referral_level?: number;
  is_campus_ambassador?: boolean;
}

export const referralsApi = {
  getCode: () =>
    run(() => convex.query(api.referrals?.myCode)) as Promise<ApiResponse<ReferralStats>>,

  getDashboard: () =>
    run(() => convex.query(api.referrals?.dashboard)) as Promise<ApiResponse<any>>,

  getLeaderboard: (limit = 20) =>
    run(() => convex.query(api.referrals?.leaderboard, { limit })) as Promise<ApiResponse<any[]>>,

  getMilestones: () =>
    run(() => convex.query(api.referrals?.milestones)) as Promise<ApiResponse<any[]>>,

  verify: (referral_code?: string, referrer_email?: string) =>
    run(() =>
      convex.query(api.referrals?.verify, { referral_code: referral_code ?? referrer_email })
    ) as Promise<ApiResponse<{ valid: boolean; referrer: { id: string; name: string } }>>,

  claim: (referral_code?: string, referrer_email?: string) =>
    run(() =>
      convex.mutation(api.referrals?.claim, { referral_code: referral_code ?? referrer_email })
    ),

  claimForNewUser: (referral_code: string) =>
    run(() => convex.mutation(api.referrals.claimForNewUser, { referral_code })),

  getStats: () =>
    run(() => convex.query(api.referrals?.stats)) as Promise<
      ApiResponse<{
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
      }>
    >,

  getAdminStats: () =>
    run(() => convex.query(api.referrals?.adminStats)) as Promise<ApiResponse<any>>,
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
    run(() =>
      convex.query(api.notifications?.list, { page, limit, unread_only })
    ) as Promise<
      ApiResponse<{
        notifications: Notification[];
        unread_count: number;
        pagination: any;
      }>
    >,

  getUnreadCount: () =>
    run(() =>
      convex.query(api.notifications?.unreadCount)
    ) as Promise<ApiResponse<{ unread_count: number }>>,

  markAsRead: (id: string) =>
    run(() => convex.mutation(api.notifications?.markRead, { id: id as any })),

  markAllAsRead: () =>
    run(() => convex.mutation(api.notifications?.readAll)),

  delete: (id: string) =>
    run(() => convex.mutation(api.notifications?.remove, { id: id as any })),

  clearAll: () =>
    run(() => convex.mutation(api.notifications?.clearAll)),
};

// ==================== UTILITY ====================

export function isApiConfigured(): boolean {
  return Boolean(import.meta.env.VITE_CONVEX_URL);
}

export function getApiBaseUrl(): string {
  return CONVEX_SITE_URL;
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
  price_type: "fixed" | "hourly" | "starting_from";
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
  status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled";
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
    sort = "created_at.desc"
  ): Promise<ApiResponse<{ services: Service[]; total: number }>> => {
    const result = await run(() =>
      convex.query(api.services.list, {
        service_type: serviceType,
        limit,
        offset,
        sort,
      })
    );
    if (result.error || !result.data) return result as ApiResponse<any>;
    const services = result.data as unknown as Service[];
    return { data: { services, total: services.length } };
  },

  // Get service by ID
  getById: async (id: string): Promise<ApiResponse<{ service: Service; reviews: ServiceReview[] }>> => {
    const result = await run(() => convex.query(api.services.byId, { id: id as any }));
    if (result.error || !result.data) return result as ApiResponse<any>;
    const { reviews, ...service } = result.data as any;
    return {
      data: {
        service: service as Service,
        reviews: (reviews ?? []) as unknown as ServiceReview[],
      },
    };
  },

  // Get service types with counts
  getTypes: async (): Promise<ApiResponse<ServiceType[]>> => {
    const result = await run(() => convex.query(api.services.metaTypes));
    if (result.error || !result.data) return result as ApiResponse<any>;
    return {
      data: (result.data as { type: string; count: number }[]).map((row) => ({
        id: row.type,
        name: row.type,
        icon: "",
        description: "",
        count: row.count,
      })),
    };
  },

  // Get provider's own services
  getMyServices: async (): Promise<ApiResponse<Service[]>> => {
    const result = await run(() => convex.query(api.services.mine));
    if (result.error || !result.data) return result as ApiResponse<any>;
    return { data: result.data as unknown as Service[] };
  },

  // Create new service
  create: async (data: {
    service_type: string;
    title: string;
    description: string;
    price: number;
    price_type: "fixed" | "hourly" | "starting_from";
    location: string;
    availability: string;
    response_time: string;
    images?: string[];
  }): Promise<ApiResponse<{ service: Service }>> => {
    const result = await run(() =>
      convex.mutation(api.services.create, {
        service_type: data.service_type,
        title: data.title,
        description: data.description,
        price: data.price,
        price_type: data.price_type,
        location: data.location,
        availability: data.availability,
        response_time: data.response_time,
        images: data.images,
      })
    );
    if (result.error || !result.data) return result as ApiResponse<any>;
    return { data: { service: result.data as unknown as Service } };
  },

  // Update service
  update: async (
    id: string,
    data: Partial<{
      service_type: string;
      title: string;
      description: string;
      price: number;
      price_type: string;
      location: string;
      availability: string;
      response_time: string;
      images: string[];
    }>
  ): Promise<ApiResponse<{ service: Service }>> => {
    const result = await run(() =>
      convex.mutation(api.services.update, {
        id: id as any,
        title: data.title,
        description: data.description,
        price: data.price,
        price_type: data.price_type,
        location: data.location,
        availability: data.availability,
        response_time: data.response_time,
        images: data.images,
      })
    );
    if (result.error || !result.data) return result as ApiResponse<any>;
    return { data: { service: result.data as unknown as Service } };
  },

  // Delete service
  delete: async (id: string): Promise<ApiResponse<{ success: boolean }>> => {
    const result = await run(() => convex.mutation(api.services.remove, { id: id as any }));
    if (result.error) return result as ApiResponse<any>;
    return { data: { success: true } };
  },

  // Toggle service active status
  toggle: async (id: string): Promise<ApiResponse<{ service: Service }>> => {
    const result = await run(() => convex.mutation(api.services.toggle, { id: id as any }));
    if (result.error || !result.data) return result as ApiResponse<any>;
    return { data: { service: result.data as unknown as Service } };
  },

  // Create service review
  createReview: async (
    serviceId: string,
    data: { rating: number; comment: string }
  ): Promise<ApiResponse<{ review: ServiceReview }>> => {
    const result = await run(() =>
      convex.mutation(api.services.review, {
        id: serviceId as any,
        rating: data.rating,
        comment: data.comment,
      })
    );
    if (result.error || !result.data) return result as ApiResponse<any>;
    return { data: { review: result.data as unknown as ServiceReview } };
  },

  // Create service booking
  createBooking: async (
    serviceId: string,
    data: { notes: string; scheduled_date: string; scheduled_time: string }
  ): Promise<ApiResponse<{ booking: ServiceBooking }>> => {
    const result = await run(() =>
      convex.mutation(api.services.book, {
        id: serviceId as any,
        scheduled_date: data.scheduled_date,
        scheduled_time: data.scheduled_time,
        notes: data.notes,
      })
    );
    if (result.error || !result.data) return result as ApiResponse<any>;
    return { data: { booking: result.data as unknown as ServiceBooking } };
  },

  // Get user's bookings (as customer or provider)
  getMyBookings: async (
    role: "customer" | "provider" = "customer"
  ): Promise<ApiResponse<{ bookings: ServiceBooking[] }>> => {
    const result = await run(() => convex.query(api.services.myBookings, { role }));
    if (result.error || !result.data) return result as ApiResponse<any>;
    return { data: { bookings: result.data as unknown as ServiceBooking[] } };
  },

  // Update booking status (provider only)
  updateBooking: async (
    id: string,
    status: "confirmed" | "in_progress" | "completed" | "cancelled"
  ): Promise<ApiResponse<{ booking: ServiceBooking }>> => {
    const result = await run(() =>
      convex.mutation(api.services.updateBooking, { id: id as any, status })
    );
    if (result.error || !result.data) return result as ApiResponse<any>;
    return { data: { booking: result.data as unknown as ServiceBooking } };
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
    run(() => convex.query(api.wallet?.info)) as Promise<ApiResponse<{ wallet: WalletInfo }>>,

  // Get withdrawal limits
  getLimits: () =>
    run(() => convex.query(api.wallet?.limits)) as Promise<ApiResponse<WithdrawalLimits>>,

  // Request withdrawal
  withdraw: (amount: number, momoNumber: string, network: string) =>
    run(() =>
      convex.mutation(api.wallet?.withdraw, {
        amount,
        momo_number: momoNumber,
        network,
      })
    ) as Promise<
      ApiResponse<{ success: boolean; message: string; wallet: WalletInfo; payout: any }>
    >,

  // Check withdrawal eligibility
  checkEligibility: (amount: number) =>
    run(() =>
      convex.query(api.wallet?.checkEligibility, { amount })
    ) as Promise<
      ApiResponse<{ eligible: boolean; reason: string; wallet_balance: number; daily_limit: number }>
    >,

  // Get transaction history
  getTransactions: (limit = 50, offset = 0, type?: string) =>
    run(async () => {
      const result = await convex.query(api.wallet?.ledger, { limit, offset });
      const transactions = ((result as any).ledger as any[]).filter(
        (entry) => !type || entry.type === type
      );
      return { transactions, has_more: (result as any).has_more };
    }) as Promise<ApiResponse<{ transactions: Transaction[]; has_more: boolean }>>,

  // Get payout history
  getPayoutHistory: (limit = 20, offset = 0) =>
    run(() =>
      convex.query(api.payouts?.history, { limit, offset })
    ) as Promise<ApiResponse<{ payouts: Payout[]; has_more: boolean }>>,

  // Get wallet ledger/history
  getLedger: (limit = 50, offset = 0) =>
    run(() =>
      convex.query(api.wallet?.ledger, { limit, offset })
    ) as Promise<ApiResponse<{ ledger: any[]; has_more: boolean }>>,
};

export const healthApi = {
  check: async (): Promise<ApiResponse<{ status: string }>> => {
    if (!CONVEX_SITE_URL) {
      return { error: "VITE_CONVEX_SITE_URL is not configured" };
    }

    try {
      const response = await fetch(`${CONVEX_SITE_URL}/health`, {
        method: "GET",
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok && (data as any)?.status === "ok") {
        return { data: { status: "ok" } };
      }

      return {
        error:
          typeof (data as any)?.error === "string"
            ? (data as any).error
            : `HTTP ${response.status}: Health check failed`,
      };
    } catch (error) {
      return { error: toMessage(error) };
    }
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
    sort = "newest"
  ): Promise<ApiResponse<BooksAndNotesItem[]>> => {
    const result = await run(() =>
      convex.query(api.books?.list, {
        book_type,
        subject,
        course_code,
        academic_level,
        condition,
        min_price,
        max_price,
        search,
        limit,
        offset,
        sort,
      })
    );
    return result as unknown as ApiResponse<BooksAndNotesItem[]>;
  },

  // Get by ID
  getById: async (id: string): Promise<ApiResponse<BooksAndNotesItem>> => {
    const result = await run(() => convex.mutation(api.books.byId, { id: id as any }));
    return result as unknown as ApiResponse<BooksAndNotesItem>;
  },

  // Get book types
  getTypes: async (): Promise<ApiResponse<string[]>> => {
    const result = await run(() => convex.query(api.books?.metaTypes));
    return result as ApiResponse<string[]>;
  },

  // Get subjects
  getSubjects: async (): Promise<ApiResponse<string[]>> => {
    const result = await run(() => convex.query(api.books?.metaSubjects));
    return result as ApiResponse<string[]>;
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
    const result = await run(() => convex.mutation(api.books?.create, { ...data }));
    return result as unknown as ApiResponse<BooksAndNotesItem>;
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
      publisher: string;
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
    const result = await run(() => convex.mutation(api.books?.update, { id: id as any, ...data }));
    return result as unknown as ApiResponse<BooksAndNotesItem>;
  },

  // Delete listing
  delete: async (id: string): Promise<ApiResponse<{ success: boolean }>> => {
    const result = await run(() => convex.mutation(api.books?.remove, { id: id as any }));
    if (result.error) return result as ApiResponse<any>;
    return { data: { success: true } };
  },

  // Mark as sold
  markAsSold: async (id: string): Promise<ApiResponse<BooksAndNotesItem>> => {
    const result = await run(() => convex.mutation(api.books?.markSold, { id: id as any }));
    return result as unknown as ApiResponse<BooksAndNotesItem>;
  },

  // Create review
  createReview: async (
    id: string,
    data: { rating: number; comment?: string }
  ): Promise<ApiResponse<any>> => {
    const result = await run(() =>
      convex.mutation(api.books?.review, { id: id as any, rating: data.rating, comment: data.comment })
    );
    return result as ApiResponse<any>;
  },

  // Get user's books
  getUserBooks: async (
    userId: string,
    limit = 20,
    offset = 0
  ): Promise<ApiResponse<BooksAndNotesItem[]>> => {
    const result = await run(() =>
      convex.query(api.books?.byUser, { userId: userId as any, limit, offset })
    );
    return result as unknown as ApiResponse<BooksAndNotesItem[]>;
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
  is_reserved?: boolean;
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
    sort = "rating"
  ): Promise<ApiResponse<FashionItem[]>> => {
    const result = await run(() =>
      convex.query(api.fashion?.list, {
        category,
        size,
        color,
        brand,
        condition,
        gender,
        limit,
        offset,
        sort,
      })
    );
    return result as unknown as ApiResponse<FashionItem[]>;
  },

  // Get by ID
  getById: async (id: string): Promise<ApiResponse<FashionItem>> => {
    const result = await run(() => convex.mutation(api.fashion.byId, { id: id as any }));
    return result as unknown as ApiResponse<FashionItem>;
  },

  // Get categories
  getCategories: async (): Promise<ApiResponse<string[]>> => {
    const result = await run(() => convex.query(api.fashion?.metaCategories));
    return result as ApiResponse<string[]>;
  },

  // Get available filters
  getFilters: async (): Promise<ApiResponse<FashionFilters>> => {
    const result = await run(() => convex.query(api.fashion?.metaFilters));
    return result as ApiResponse<FashionFilters>;
  },

  // Create listing
  create: async (data: {
    title: string;
    description?: string;
    price: number;
    price_type?: "fixed" | "hourly" | "from";
    location?: string;
    size?: string;
    color?: string;
    brand?: string;
    condition?: string;
    gender?: string;
    images?: string[];
  }): Promise<ApiResponse<{ service: FashionItem }>> => {
    const result = await run(() =>
      convex.mutation(api.fashion?.create, {
        title: data.title,
        description: data.description,
        category: (data as any).category ?? "clothing",
        gender: data.gender ?? "unisex",
        size: data.size,
        color: data.color,
        brand: data.brand,
        condition: data.condition ?? "good",
        price: data.price,
        location: data.location,
        images: data.images,
      })
    );
    if (result.error || !result.data) return result as ApiResponse<any>;
    return { data: { service: result.data } };
  },

  // Update listing
  update: async (
    id: string,
    data: Partial<{
      title: string;
      description: string;
      price: number;
      price_type: "fixed" | "hourly" | "from";
      location: string;
      size: string;
      color: string;
      brand: string;
      condition: string;
      gender: string;
      images: string[];
    }>
  ): Promise<ApiResponse<{ service: FashionItem }>> => {
    const result = await run(() => convex.mutation(api.fashion?.update, { id: id as any, ...data }));
    if (result.error || !result.data) return result as ApiResponse<any>;
    return { data: { service: result.data } };
  },

  // Delete listing
  delete: async (id: string): Promise<ApiResponse<{ success: boolean }>> => {
    const result = await run(() => convex.mutation(api.fashion?.remove, { id: id as any }));
    if (result.error) return result as ApiResponse<any>;
    return { data: { success: true } };
  },

  // Toggle active status
  toggle: async (id: string): Promise<ApiResponse<{ service: FashionItem }>> => {
    const result = await run(() => convex.mutation(api.fashion.toggle, { id: id as any }));
    if (result.error || !result.data) return result as ApiResponse<any>;
    return { data: { service: result.data } };
  },

  // Create review
  createReview: async (
    id: string,
    data: { rating: number; comment?: string }
  ): Promise<ApiResponse<any>> => {
    const result = await run(() =>
      convex.mutation(api.fashion?.review, {
        id: id as any,
        rating: data.rating,
        comment: data.comment,
      })
    );
    return result as ApiResponse<any>;
  },

  // Mark as sold
  markAsSold: async (id: string): Promise<ApiResponse<FashionItem>> => {
    const result = await run(() => convex.mutation(api.fashion?.markSold, { id: id as any }));
    return result as unknown as ApiResponse<FashionItem>;
  },

  // Get user's fashion items
  getUserFashion: async (
    userId: string,
    limit = 20,
    offset = 0
  ): Promise<ApiResponse<FashionItem[]>> => {
    const result = await run(() =>
      convex.query(api.fashion?.byUser, { userId: userId as any, limit, offset })
    );
    return result as unknown as ApiResponse<FashionItem[]>;
  },

  // Get brands
  getBrands: async (): Promise<ApiResponse<string[]>> => {
    const result = await run(() => convex.query(api.fashion.metaBrands));
    return result as ApiResponse<string[]>;
  },
};

// Ratings API
export const ratingsApi = {
  // Get seller rating stats
  getSellerStats: async (sellerId: string): Promise<ApiResponse<any>> => {
    const result = await run(() =>
      convex.query(api.ratings.sellerStats, { sellerId: sellerId as any })
    );
    return result as ApiResponse<any>;
  },

  // Get ratings for a seller
  getSellerRatings: async (
    sellerId: string,
    page = 1,
    limit = 10,
    sort = "recent"
  ): Promise<ApiResponse<any>> => {
    const result = await run(() =>
      convex.query(api.ratings.sellerRatings, { sellerId: sellerId as any, page, limit, sort })
    );
    return result as ApiResponse<any>;
  },

  // Get rating for a specific order
  getOrderRating: async (orderId: string): Promise<ApiResponse<any>> => {
    const result = await run(() =>
      convex.query(api.ratings.orderRating, { orderId: orderId as any })
    );
    return result as ApiResponse<any>;
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
    const result = await run(() =>
      convex.mutation(api.ratings.create, {
        order_id: data.order_id as any,
        seller_id: data.seller_id as any,
        overall_rating: data.overall_rating,
        product_quality_rating: data.product_quality_rating,
        communication_rating: data.communication_rating,
        delivery_speed_rating: data.delivery_speed_rating,
        packaging_rating: data.packaging_rating,
        value_for_money_rating: data.value_for_money_rating,
        review_text: data.review_text,
        review_title: data.review_title,
        feedback_tags: data.feedback_tags,
        review_photos: data.review_photos,
        is_anonymous: data.is_anonymous,
      })
    );
    return result as ApiResponse<any>;
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
    const result = await run(() =>
      convex.mutation(api.ratings.update, {
        id: ratingId as any,
        overall_rating: data.overall_rating,
        review_text: data.review_text,
        review_title: data.review_title,
      })
    );
    return result as ApiResponse<any>;
  },

  // Add seller response to a rating
  addSellerResponse: async (
    ratingId: string,
    response: string
  ): Promise<ApiResponse<any>> => {
    const result = await run(() =>
      convex.mutation(api.ratings.respond, { id: ratingId as any, response })
    );
    return result as ApiResponse<any>;
  },

  // Vote on rating helpfulness
  voteHelpful: async (
    ratingId: string,
    isHelpful: boolean
  ): Promise<ApiResponse<any>> => {
    const result = await run(() =>
      convex.mutation(api.ratings?.markHelpful, { id: ratingId as any, is_helpful: isHelpful })
    );
    return result as ApiResponse<any>;
  },

  // Get user's rating history
  getUserHistory: async (page = 1, limit = 10): Promise<ApiResponse<any>> => {
    const result = await run(() => convex.query(api.ratings?.userHistory, { page, limit }));
    return result as ApiResponse<any>;
  },

  // Get orders eligible for rating
  getEligibleOrders: async (): Promise<ApiResponse<any>> => {
    const result = await run(() => convex.query(api.ratings?.eligibleOrders));
    return result as ApiResponse<any>;
  },

  // Get product rating stats
  getProductStats: async (productId: string): Promise<ApiResponse<any>> => {
    const result = await run(() =>
      convex.query(api.ratings?.productStats, { productId: productId as any })
    );
    return result as ApiResponse<any>;
  },

  // Get ratings for a product
  getProductRatings: async (
    productId: string,
    page = 1,
    limit = 10,
    sort = "recent"
  ): Promise<ApiResponse<any>> => {
    const result = await run(() =>
      convex.query(api.ratings?.productRatings, { productId: productId as any, page, limit, sort })
    );
    return result as ApiResponse<any>;
  },

  // Submit a product rating
  createProductRating: async (data: {
    product_id: string;
    rating: number;
    comment?: string;
  }): Promise<ApiResponse<any>> => {
    const result = await run(() =>
      convex.mutation(api.ratings?.rateProduct, {
        product_id: data.product_id as any,
        rating: data.rating,
        comment: data.comment,
      })
    );
    return result as ApiResponse<any>;
  },
};

// Website Feedback API
export const feedbackApi = {
  uploadReportScreenshot: (file: File) =>
    uploadImage(file, "/report-upload"),

  fetchReportScreenshot: async (url: string): Promise<ApiResponse<Blob>> => {
    const token = convexAccessToken();
    if (!token) return { error: "Sign in with an administrator account to view this screenshot." };
    try {
      const target = new URL(url);
      const expectedOrigin = new URL(CONVEX_SITE_URL).origin;
      if (target.origin !== expectedOrigin || !target.pathname.startsWith("/report-file/")) {
        return { error: "Screenshot URL is not a trusted White Market file." };
      }
      const response = await fetch(target.href, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        return { error: response.status === 403 ? "Administrator access is required." : "Screenshot could not be loaded." };
      }
      return { data: await response.blob() };
    } catch (error) {
      return { error: toMessage(error) };
    }
  },

  // Submit website feedback
  submitFeedback: async (data: {
    rating?: number;
    feedback_type?: string;
    feedback_text?: string;
    reporter_email?: string;
    report_image_urls?: string[];
    would_recommend?: boolean;
    improved_features?: string[];
    is_satisfied?: boolean;
    page_url?: string;
    session_duration_seconds?: number;
  }): Promise<ApiResponse<any>> => {
    const result = await run(() => convex.mutation(api.feedback.create, { ...data }));
    return result as ApiResponse<any>;
  },

  // Get top testimonials for home page
  getTestimonials: async (limit = 3): Promise<ApiResponse<any>> => {
    const result = await run(() => convex.query(api.feedback.testimonials, { limit }));
    return result as ApiResponse<any>;
  },

  // Get feedback stats
  getStats: async (): Promise<ApiResponse<any>> => {
    const result = await run(() => convex.query(api.feedback.stats));
    return result as ApiResponse<any>;
  },

  // Get all feedback (admin only)
  getAll: async (page = 1, limit = 20): Promise<ApiResponse<any>> => {
    const result = await run(() => convex.query(api.feedback.list, { page, limit }));
    return result as ApiResponse<any>;
  },

  // Get single feedback (admin only)
  getById: async (feedbackId: string): Promise<ApiResponse<any>> => {
    const result = await run(() => convex.query(api.feedback?.byId, { id: feedbackId as any }));
    return result as ApiResponse<any>;
  },
};
