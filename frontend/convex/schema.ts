import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

/**
 * White Market schema.
 *
 * The Convex Auth `users` table is inlined (rather than spread from
 * `authTables`) so White Market profile fields can live on the same document as
 * the auth identity. The remaining auth tables are spread from `authTables`.
 *
 * Money lives in exactly two places: `wallets` (current balances) and
 * `wallet_transactions` (the append-only ledger). There is no `wallet_ledger`
 * table and no `users.wallet_balance` column.
 */

const userProfileFields = {
  full_name: v.optional(v.string()),
  role: v.optional(v.string()),
  avatar_url: v.optional(v.string()),
  campus: v.optional(v.string()),
  whatsapp: v.optional(v.string()),
  momo_number: v.optional(v.string()),
  momo_provider: v.optional(v.string()),
  paystack_recipient_code: v.optional(v.string()),

  seller_display_name: v.optional(v.string()),
  seller_profile_image_url: v.optional(v.string()),
  seller_bio: v.optional(v.string()),
  seller_response_time: v.optional(v.string()),

  verified: v.optional(v.boolean()),
  verification_status: v.optional(v.string()),

  referral_code: v.optional(v.string()),
  referred_by: v.optional(v.id("users")),
  referral_level: v.optional(v.number()),
  total_referrals: v.optional(v.number()),
  qualified_buyer_referrals: v.optional(v.number()),
  qualified_seller_referrals: v.optional(v.number()),
  platform_credit: v.optional(v.number()),
  referral_earnings: v.optional(v.number()),
  total_referral_credits: v.optional(v.number()),
  commission_discount_sales_remaining: v.optional(v.number()),
  is_campus_ambassador: v.optional(v.boolean()),
  referral_ambassador_discount_active: v.optional(v.boolean()),

  account_weight: v.optional(v.number()),
  total_sales: v.optional(v.number()),
  successful_transactions: v.optional(v.number()),
  last_sale_at: v.optional(v.number()),
  is_payout_frozen: v.optional(v.boolean()),
  fraud_flags: v.optional(v.array(v.string())),
  payout_pin: v.optional(v.string()),

  last_name_change: v.optional(v.number()),
  created_at: v.optional(v.number()),
  updated_at: v.optional(v.number()),
};

export default defineSchema({
  ...authTables,

  users: defineTable({
    // --- Convex Auth identity fields ---
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    // --- White Market profile fields ---
    ...userProfileFields,
    account_deleted_at: v.optional(v.number()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"])
    .index("referral_code", ["referral_code"]),

  products: defineTable({
    seller_id: v.id("users"),
    title: v.string(),
    description: v.optional(v.string()),
    price: v.number(),
    image_url: v.optional(v.string()),
    category_id: v.optional(v.id("categories")),
    category: v.optional(v.string()),
    condition: v.optional(v.string()),
    campus: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    is_active: v.optional(v.boolean()),
    stock_quantity: v.optional(v.number()),
    view_count: v.optional(v.number()),
    click_count: v.optional(v.number()),
    purchase_count: v.optional(v.number()),
    like_count: v.optional(v.number()),
    average_rating: v.optional(v.number()),
    rating_count: v.optional(v.number()),
    negotiable: v.optional(v.boolean()),
    created_at: v.optional(v.number()),
    updated_at: v.optional(v.number()),
  })
    .index("by_seller", ["seller_id"])
    .index("by_category", ["category_id"])
    .index("by_active", ["is_active"]),

  categories: defineTable({
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    image_url: v.optional(v.string()),
    icon: v.optional(v.string()),
    display_order: v.optional(v.number()),
    parent_id: v.optional(v.id("categories")),
    is_active: v.optional(v.boolean()),
    created_at: v.optional(v.number()),
  })
    .index("by_slug", ["slug"])
    .index("by_order", ["display_order"]),

  orders: defineTable({
    product_id: v.optional(v.id("products")),
    fashion_id: v.optional(v.id("fashion")),
    buyer_id: v.id("users"),
    seller_id: v.id("users"),
    amount: v.number(),
    commission: v.optional(v.number()),
    seller_earning: v.optional(v.number()),
    status: v.string(),
    payment_reference: v.optional(v.string()),
    payment_method: v.optional(v.string()),
    momo_network: v.optional(v.string()),
    momo_number: v.optional(v.string()),
    delivery_status: v.optional(v.string()),
    item_amount: v.optional(v.number()),
    delivery_fee: v.optional(v.number()),
    delivery_method: v.optional(v.string()),
    credit_used: v.optional(v.number()),
    payout_status: v.optional(v.string()),
    is_rated: v.optional(v.boolean()),
    paid_at: v.optional(v.number()),
    completed_at: v.optional(v.number()),
    created_at: v.optional(v.number()),
    updated_at: v.optional(v.number()),
  })
    .index("by_buyer", ["buyer_id"])
    .index("by_seller", ["seller_id"])
    .index("by_status", ["status"]),

  /** Current balances. One row per user. */
  wallets: defineTable({
    user_id: v.id("users"),
    balance: v.optional(v.number()),
    pending_earnings: v.optional(v.number()),
    currency: v.optional(v.string()),
    created_at: v.optional(v.number()),
    updated_at: v.optional(v.number()),
  }).index("by_user", ["user_id"]),

  /** Append-only money ledger. Every balance change writes a row here. */
  wallet_transactions: defineTable({
    user_id: v.id("users"),
    type: v.string(),
    amount: v.number(),
    description: v.optional(v.string()),
    reference_id: v.optional(v.string()),
    reference_type: v.optional(v.string()),
    balance_after: v.optional(v.number()),
    created_at: v.optional(v.number()),
  })
    .index("by_user", ["user_id"])
    .index("by_user_created", ["user_id", "created_at"]),

  payouts: defineTable({
    seller_id: v.id("users"),
    order_id: v.optional(v.id("orders")),
    amount: v.number(),
    net_amount: v.optional(v.number()),
    status: v.string(),
    funds_reserved: v.optional(v.boolean()),
    momo_number: v.optional(v.string()),
    momo_network: v.optional(v.string()),
    paystack_recipient_code: v.optional(v.string()),
    transfer_reference: v.optional(v.string()),
    failure_reason: v.optional(v.string()),
    notes: v.optional(v.string()),
    created_at: v.optional(v.number()),
    processed_at: v.optional(v.number()),
  })
    .index("by_seller", ["seller_id"])
    .index("by_status", ["status"])
    .index("by_transfer_reference", ["transfer_reference"]),

  transactions: defineTable({
    order_id: v.optional(v.id("orders")),
    buyer_id: v.id("users"),
    seller_id: v.id("users"),
    amount: v.number(),
    item_amount: v.optional(v.number()),
    delivery_fee: v.optional(v.number()),
    rider_compensation: v.optional(v.number()),
    transport_cost: v.optional(v.number()),
    delivery_margin: v.optional(v.number()),
    rider_compensation_paid_at: v.optional(v.number()),
    commission: v.optional(v.number()),
    seller_earning: v.optional(v.number()),
    status: v.string(),
    payment_reference: v.optional(v.string()),
    created_at: v.optional(v.number()),
  })
    .index("by_seller", ["seller_id"])
    .index("by_buyer", ["buyer_id"])
    .index("by_order", ["order_id"]),

  conversations: defineTable({
    product_id: v.optional(v.id("products")),
    buyer_id: v.id("users"),
    seller_id: v.id("users"),
    last_message_id: v.optional(v.string()),
    last_message_at: v.optional(v.number()),
    created_at: v.optional(v.number()),
    updated_at: v.optional(v.number()),
  })
    .index("by_buyer", ["buyer_id"])
    .index("by_seller", ["seller_id"]),

  messages: defineTable({
    conversation_id: v.id("conversations"),
    sender_id: v.id("users"),
    receiver_id: v.id("users"),
    text: v.optional(v.string()),
    image_url: v.optional(v.string()),
    status: v.optional(v.string()),
    read_at: v.optional(v.number()),
    created_at: v.optional(v.number()),
  })
    .index("by_conversation", ["conversation_id"])
    .index("by_conversation_created", ["conversation_id", "created_at"])
    .index("by_receiver", ["receiver_id"]),

  rider_applications: defineTable({
    user_id: v.id("users"),
    legal_name: v.string(),
    phone: v.string(),
    student_id_number: v.string(),
    document_storage_id: v.optional(v.id("_storage")),
    document_content_type: v.optional(v.string()),
    status: v.string(),
    rejection_reason: v.optional(v.string()),
    reviewed_by: v.optional(v.id("users")),
    reviewed_at: v.optional(v.number()),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_user", ["user_id"])
    .index("by_status", ["status"]),

  delivery_locations: defineTable({
    name: v.string(),
    category: v.string(),
    is_active: v.boolean(),
    created_at: v.number(),
    updated_at: v.number(),
  }).index("by_active", ["is_active"]),

  delivery_zones: defineTable({
    name: v.string(),
    fee: v.number(),
    rider_compensation: v.optional(v.number()),
    transport_cost: v.optional(v.number()),
    is_configured: v.boolean(),
    is_active: v.boolean(),
    updated_by: v.id("users"),
    updated_at: v.number(),
  }).index("by_active", ["is_active"]),

  deliveries: defineTable({
    order_id: v.id("orders"),
    buyer_id: v.id("users"),
    seller_id: v.id("users"),
    rider_id: v.optional(v.id("users")),
    rider_name_snapshot: v.optional(v.string()),
    rider_phone_snapshot: v.optional(v.string()),
    destination_id: v.optional(v.id("delivery_locations")),
    destination_name: v.optional(v.string()),
    zone_id: v.optional(v.id("delivery_zones")),
    zone_name: v.optional(v.string()),
    meeting_point: v.optional(v.string()),
    delivery_fee: v.number(),
    rider_compensation: v.optional(v.number()),
    transport_cost: v.optional(v.number()),
    delivery_margin: v.optional(v.number()),
    status: v.string(),
    assigned_at: v.optional(v.number()),
    picked_up_at: v.optional(v.number()),
    delivered_at: v.optional(v.number()),
    completed_at: v.optional(v.number()),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_order", ["order_id"])
    .index("by_rider", ["rider_id"])
    .index("by_status", ["status"])
    .index("by_buyer", ["buyer_id"])
    .index("by_seller", ["seller_id"]),

  delivery_events: defineTable({
    delivery_id: v.id("deliveries"),
    order_id: v.id("orders"),
    actor_id: v.id("users"),
    actor_role: v.string(),
    event: v.string(),
    note: v.optional(v.string()),
    created_at: v.number(),
  })
    .index("by_delivery", ["delivery_id"])
    .index("by_order", ["order_id"]),

  delivery_complaints: defineTable({
    delivery_id: v.id("deliveries"),
    order_id: v.id("orders"),
    raised_by: v.id("users"),
    reason: v.string(),
    details: v.string(),
    status: v.string(),
    resolution: v.optional(v.string()),
    resolved_by: v.optional(v.id("users")),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_delivery", ["delivery_id"])
    .index("by_status", ["status"]),

  verifications: defineTable({
    user_id: v.id("users"),
    document_type: v.string(),
    document_url: v.optional(v.string()),
    document_storage_id: v.optional(v.id("_storage")),
    document_content_type: v.optional(v.string()),
    status: v.string(),
    reviewed_by: v.optional(v.id("users")),
    rejection_reason: v.optional(v.string()),
    created_at: v.optional(v.number()),
    updated_at: v.optional(v.number()),
  })
    .index("by_user", ["user_id"])
    .index("by_status", ["status"]),

  notifications: defineTable({
    user_id: v.id("users"),
    type: v.string(),
    title: v.string(),
    body: v.optional(v.string()),
    data: v.optional(v.any()),
    read: v.optional(v.boolean()),
    created_at: v.optional(v.number()),
  })
    .index("by_user", ["user_id"])
    .index("by_user_read", ["user_id", "read"]),

  /** Legacy order reviews (the `/reviews` endpoints). */
  reviews: defineTable({
    order_id: v.optional(v.id("orders")),
    product_id: v.optional(v.id("products")),
    reviewer_id: v.id("users"),
    reviewee_id: v.id("users"),
    rating: v.number(),
    comment: v.optional(v.string()),
    is_seller_review: v.optional(v.boolean()),
    created_at: v.optional(v.number()),
    updated_at: v.optional(v.number()),
  })
    .index("by_reviewee", ["reviewee_id"])
    .index("by_order", ["order_id"]),

  product_ratings: defineTable({
    product_id: v.id("products"),
    buyer_id: v.id("users"),
    rating: v.number(),
    comment: v.optional(v.string()),
    is_verified_purchase: v.optional(v.boolean()),
    is_anonymous: v.optional(v.boolean()),
    helpful_count: v.optional(v.number()),
    created_at: v.optional(v.number()),
    updated_at: v.optional(v.number()),
  })
    .index("by_product", ["product_id"])
    .index("by_buyer", ["buyer_id"]),

  seller_ratings: defineTable({
    order_id: v.optional(v.id("orders")),
    buyer_id: v.id("users"),
    seller_id: v.id("users"),
    overall_rating: v.number(),
    product_quality_rating: v.optional(v.number()),
    communication_rating: v.optional(v.number()),
    delivery_speed_rating: v.optional(v.number()),
    packaging_rating: v.optional(v.number()),
    value_for_money_rating: v.optional(v.number()),
    review_text: v.optional(v.string()),
    review_title: v.optional(v.string()),
    feedback_tags: v.optional(v.array(v.string())),
    review_photos: v.optional(v.array(v.string())),
    seller_response: v.optional(v.string()),
    seller_responded_at: v.optional(v.number()),
    is_verified_purchase: v.optional(v.boolean()),
    is_anonymous: v.optional(v.boolean()),
    helpful_count: v.optional(v.number()),
    created_at: v.optional(v.number()),
    updated_at: v.optional(v.number()),
  })
    .index("by_seller", ["seller_id"])
    .index("by_buyer", ["buyer_id"])
    .index("by_order", ["order_id"]),

  seller_badges: defineTable({
    seller_id: v.id("users"),
    badge_type: v.string(),
    badge_name: v.string(),
    badge_description: v.optional(v.string()),
    badge_icon: v.optional(v.string()),
    earned_at: v.optional(v.number()),
    is_active: v.optional(v.boolean()),
  }).index("by_seller", ["seller_id"]),

  rating_helpful_votes: defineTable({
    rating_id: v.id("seller_ratings"),
    user_id: v.id("users"),
    is_helpful: v.boolean(),
    created_at: v.optional(v.number()),
  }).index("by_rating", ["rating_id"]),

  favorites: defineTable({
    user_id: v.id("users"),
    product_id: v.id("products"),
    created_at: v.optional(v.number()),
  })
    .index("by_user", ["user_id"])
    .index("by_product", ["product_id"]),

  likes: defineTable({
    user_id: v.id("users"),
    product_id: v.id("products"),
    created_at: v.optional(v.number()),
  })
    .index("by_user", ["user_id"])
    .index("by_product", ["product_id"]),

  referrals: defineTable({
    referrer_id: v.id("users"),
    referred_id: v.id("users"),
    referral_code: v.optional(v.string()),
    referral_type: v.optional(v.string()),
    status: v.string(),
    reward_amount: v.optional(v.number()),
    reward_given_at: v.optional(v.number()),
    qualified_at: v.optional(v.number()),
    purchase_completed_at: v.optional(v.number()),
    seller_listed_at: v.optional(v.number()),
    reward_claimed: v.optional(v.boolean()),
    created_at: v.optional(v.number()),
  })
    .index("by_referrer", ["referrer_id"])
    .index("by_referred", ["referred_id"])
    .index("by_code", ["referral_code"]),

  referral_rewards: defineTable({
    user_id: v.id("users"),
    referral_id: v.optional(v.id("referrals")),
    reward_type: v.string(),
    reward_value: v.optional(v.number()),
    description: v.optional(v.string()),
    created_at: v.optional(v.number()),
  }).index("by_user", ["user_id"]),

  services: defineTable({
    seller_id: v.id("users"),
    service_type: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    price: v.number(),
    price_type: v.optional(v.string()),
    location: v.optional(v.string()),
    availability: v.optional(v.any()),
    response_time: v.optional(v.string()),
    images: v.optional(v.array(v.string())),
    is_active: v.optional(v.boolean()),
    is_verified: v.optional(v.boolean()),
    rating: v.optional(v.number()),
    review_count: v.optional(v.number()),
    completed_jobs: v.optional(v.number()),
    created_at: v.optional(v.number()),
    updated_at: v.optional(v.number()),
  })
    .index("by_seller", ["seller_id"])
    .index("by_type", ["service_type"]),

  service_reviews: defineTable({
    service_id: v.id("services"),
    reviewer_id: v.id("users"),
    provider_id: v.id("users"),
    rating: v.number(),
    comment: v.optional(v.string()),
    created_at: v.optional(v.number()),
  }).index("by_service", ["service_id"]),

  service_bookings: defineTable({
    service_id: v.id("services"),
    customer_id: v.id("users"),
    provider_id: v.id("users"),
    status: v.string(),
    scheduled_date: v.optional(v.string()),
    scheduled_time: v.optional(v.string()),
    notes: v.optional(v.string()),
    price: v.optional(v.number()),
    created_at: v.optional(v.number()),
    updated_at: v.optional(v.number()),
  })
    .index("by_customer", ["customer_id"])
    .index("by_provider", ["provider_id"]),

  books: defineTable({
    seller_id: v.id("users"),
    title: v.string(),
    description: v.optional(v.string()),
    isbn: v.optional(v.string()),
    author: v.optional(v.string()),
    edition: v.optional(v.string()),
    publisher: v.optional(v.string()),
    book_type: v.string(),
    subject: v.optional(v.string()),
    course_code: v.optional(v.string()),
    academic_level: v.optional(v.string()),
    condition: v.string(),
    price: v.number(),
    price_negotiable: v.optional(v.boolean()),
    page_count: v.optional(v.number()),
    language: v.optional(v.string()),
    location: v.optional(v.string()),
    images: v.optional(v.array(v.string())),
    is_active: v.optional(v.boolean()),
    is_sold: v.optional(v.boolean()),
    view_count: v.optional(v.number()),
    rating: v.optional(v.number()),
    review_count: v.optional(v.number()),
    created_at: v.optional(v.number()),
    updated_at: v.optional(v.number()),
  })
    .index("by_seller", ["seller_id"])
    .index("by_type", ["book_type"]),

  book_reviews: defineTable({
    book_id: v.id("books"),
    reviewer_id: v.id("users"),
    seller_id: v.id("users"),
    rating: v.number(),
    comment: v.optional(v.string()),
    created_at: v.optional(v.number()),
  }).index("by_book", ["book_id"]),

  fashion: defineTable({
    seller_id: v.id("users"),
    title: v.string(),
    description: v.optional(v.string()),
    category: v.string(),
    gender: v.string(),
    size: v.optional(v.string()),
    color: v.optional(v.string()),
    brand: v.optional(v.string()),
    material: v.optional(v.string()),
    pattern: v.optional(v.string()),
    condition: v.string(),
    price: v.number(),
    price_negotiable: v.optional(v.boolean()),
    original_price: v.optional(v.number()),
    location: v.optional(v.string()),
    images: v.optional(v.array(v.string())),
    is_active: v.optional(v.boolean()),
    is_sold: v.optional(v.boolean()),
    reserved_order_id: v.optional(v.id("orders")),
    view_count: v.optional(v.number()),
    rating: v.optional(v.number()),
    review_count: v.optional(v.number()),
    created_at: v.optional(v.number()),
    updated_at: v.optional(v.number()),
  })
    .index("by_seller", ["seller_id"])
    .index("by_category", ["category"]),

  fashion_reviews: defineTable({
    fashion_id: v.id("fashion"),
    reviewer_id: v.id("users"),
    seller_id: v.id("users"),
    rating: v.number(),
    comment: v.optional(v.string()),
    created_at: v.optional(v.number()),
  }).index("by_fashion", ["fashion_id"]),

  disputes: defineTable({
    order_id: v.id("orders"),
    raised_by: v.id("users"),
    reason: v.string(),
    description: v.optional(v.string()),
    status: v.string(),
    previous_order_status: v.optional(v.string()),
    resolution: v.optional(v.string()),
    resolved_by: v.optional(v.id("users")),
    resolved_at: v.optional(v.number()),
    created_at: v.optional(v.number()),
    updated_at: v.optional(v.number()),
  })
    .index("by_order", ["order_id"])
    .index("by_status", ["status"]),

  search_history: defineTable({
    user_id: v.id("users"),
    query: v.string(),
    created_at: v.optional(v.number()),
  }).index("by_user", ["user_id"]),

  website_feedback: defineTable({
    user_id: v.optional(v.id("users")),
    rating: v.optional(v.number()),
    feedback_type: v.optional(v.string()),
    feedback_text: v.optional(v.string()),
    reporter_email: v.optional(v.string()),
    report_image_urls: v.optional(v.array(v.string())),
    would_recommend: v.optional(v.boolean()),
    improved_features: v.optional(v.array(v.string())),
    is_satisfied: v.optional(v.boolean()),
    page_url: v.optional(v.string()),
    session_duration_seconds: v.optional(v.number()),
    status: v.optional(v.string()),
    created_at: v.optional(v.number()),
  }).index("by_status", ["status"]),

  system_settings: defineTable({
    key: v.string(),
    value: v.optional(v.string()),
  }).index("by_key", ["key"]),

  rating_reminders: defineTable({
    order_id: v.id("orders"),
    buyer_id: v.id("users"),
    reminder_count: v.number(),
    last_reminded_at: v.optional(v.number()),
    created_at: v.optional(v.number()),
  }).index("by_buyer", ["buyer_id"]),
});
