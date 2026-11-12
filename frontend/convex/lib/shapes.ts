import type { Doc } from "../_generated/dataModel";

/** Convex stores timestamps as epoch millis; the frontend expects ISO strings. */
export function toIso(timestamp: number | undefined | null): string | undefined {
  if (timestamp === undefined || timestamp === null) return undefined;
  return new Date(timestamp).toISOString();
}

export function toIsoOrNull(timestamp: number | undefined | null): string | null {
  const iso = toIso(timestamp);
  return iso ?? null;
}

type ProductDoc = Doc<"products">;

export interface ProductShape {
  id: string;
  seller_id: string;
  title: string;
  description?: string;
  price: number;
  image_url?: string;
  category_id?: string;
  category?: string;
  condition?: string;
  is_active?: boolean;
  stock_quantity?: number;
  view_count?: number;
  like_count?: number;
  average_rating?: number;
  rating_count?: number;
  negotiable?: boolean;
  created_at?: string;
  updated_at?: string;
  users?: {
    full_name: string;
    email: string;
    verified?: boolean;
    seller_display_name?: string;
    seller_profile_image_url?: string;
    avatar_url?: string;
  };
  categories?: { name: string; slug: string };
}

export function productShape(
  product: ProductDoc,
  seller?: Doc<"users"> | null,
  category?: Doc<"categories"> | null,
  sellerVerified = false
): ProductShape {
  return {
    id: product._id,
    seller_id: product.seller_id,
    title: product.title,
    description: product.description,
    price: product.price,
    image_url: product.image_url,
    category_id: product.category_id,
    category: product.category ?? category?.name,
    condition: product.condition,
    is_active: product.is_active ?? true,
    stock_quantity: product.stock_quantity,
    view_count: product.view_count ?? 0,
    like_count: product.like_count ?? 0,
    average_rating: product.average_rating ?? 0,
    rating_count: product.rating_count ?? 0,
    negotiable: product.negotiable,
    created_at: toIso(product.created_at),
    updated_at: toIso(product.updated_at),
    users: seller
      ? {
          full_name: seller.full_name ?? seller.name ?? "",
          email: seller.email ?? "",
          verified: sellerVerified,
          seller_display_name: seller.seller_display_name ?? undefined,
          seller_profile_image_url: seller.seller_profile_image_url ?? undefined,
          avatar_url: seller.avatar_url ?? seller.image ?? undefined,
        }
      : undefined,
    categories: category ? { name: category.name, slug: category.slug } : undefined,
  };
}

export function orderShape(
  order: Doc<"orders">,
  product?: Doc<"products"> | null,
  fashion?: Doc<"fashion"> | null
) {
  return {
    id: order._id,
    product_id: order.product_id,
    fashion_id: order.fashion_id,
    buyer_id: order.buyer_id,
    seller_id: order.seller_id,
    amount: order.amount,
    item_amount: order.item_amount ?? order.amount - (order.delivery_fee ?? 0),
    delivery_fee: order.delivery_fee ?? 0,
    delivery_method: order.delivery_method ?? "campus_pickup",
    payment_method: order.payment_method,
    commission: order.commission,
    seller_earning: order.seller_earning,
    status: order.status,
    payment_reference: order.payment_reference,
    delivery_status: order.delivery_status,
    payout_status: order.payout_status,
    is_rated: order.is_rated,
    created_at: toIso(order.created_at),
    paid_at: toIso(order.paid_at),
    completed_at: toIso(order.completed_at),
    products: product
      ? { title: product.title, image_url: product.image_url ?? "" }
      : fashion
        ? { title: fashion.title, image_url: fashion.images?.[0] ?? "" }
        : undefined,
  };
}
