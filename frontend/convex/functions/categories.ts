import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireProfile, requireUserId } from "../lib/auth";
import { slugify } from "../lib/ids";

const DEFAULT_CATEGORIES = [
  { name: "Clothing & Fashion", slug: "clothing", description: "Student fashion, uniforms, and traditional wear", icon: "Shirt" },
  { name: "Food & Snacks", slug: "food", description: "Homemade food, snacks, and beverages", icon: "Utensils" },
  { name: "Electronics & Gadgets", slug: "electronics", description: "Phones, laptops, and accessories", icon: "Smartphone" },
  { name: "Books & Notes", slug: "books", description: "Textbooks, lecture notes, and past questions", icon: "BookOpen" },
  { name: "Services", slug: "services", description: "Tutoring, printing, errands, and repairs", icon: "Wrench" },
  { name: "Beauty & Health", slug: "beauty", description: "Skincare, haircare, and wellness products", icon: "Sparkles" },
  { name: "Housing & Rooms", slug: "housing", description: "Hostel rooms, apartments, and sublets", icon: "Home" },
  { name: "Sports & Fitness", slug: "sports", description: "Gym equipment and sports gear", icon: "Dumbbell" },
  { name: "Events & Tickets", slug: "events", description: "Event tickets and party supplies", icon: "Ticket" },
  { name: "Other", slug: "other", description: "Miscellaneous items", icon: "Package" },
];

export const ensureDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("categories").take(1);
    if (existing.length > 0) return { created: false };

    for (const [display_order, category] of DEFAULT_CATEGORIES.entries()) {
      await ctx.db.insert("categories", {
        ...category,
        display_order,
        is_active: true,
        created_at: Date.now(),
      });
    }

    return { created: true };
  },
});

export const list = query({
  handler: async (ctx) => {
    const categories = await ctx.db.query("categories").collect();
    const products = await ctx.db.query("products").collect();

    const counts = new Map<string, number>();
    for (const product of products) {
      if (!product.category_id) continue;
      counts.set(product.category_id, (counts.get(product.category_id) ?? 0) + 1);
    }

    return categories
      .filter((category) => category.is_active !== false)
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
      .map((category) => ({
        id: category._id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        image_url: category.image_url,
        icon: category.icon,
        display_order: category.display_order,
        product_count: counts.get(category._id) ?? 0,
        is_active: category.is_active !== false,
      }));
  },
});

export const listForAdmin = query({
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const admin = await requireProfile(ctx, userId);
    if (admin.role !== "admin") throw new Error("Admin access only");

    const categories = await ctx.db.query("categories").collect();
    const products = await ctx.db.query("products").collect();
    const counts = new Map<string, number>();
    for (const product of products) {
      if (!product.category_id) continue;
      counts.set(product.category_id, (counts.get(product.category_id) ?? 0) + 1);
    }

    return categories
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
      .map((category) => ({
        id: category._id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        image_url: category.image_url,
        icon: category.icon,
        sort_order: category.display_order ?? 0,
        product_count: counts.get(category._id) ?? 0,
        is_active: category.is_active !== false,
      }));
  },
});

export const get = query({
  args: { id: v.id("categories"), page: v.optional(v.number()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const category = await ctx.db.get(args.id);
    if (!category) throw new Error("Category not found");

    const page = Math.max(1, args.page ?? 1);
    const limit = Math.min(100, Math.max(1, args.limit ?? 20));
    const offset = (page - 1) * limit;

    const all = (await ctx.db.query("products").collect())
      .filter((product) => product.category_id === args.id && product.is_active !== false)
      .sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0));

    const products = all.slice(offset, offset + limit);
    const sellerIds = [...new Set(products.map((p) => p.seller_id))];
    const sellers = await Promise.all(sellerIds.map((id) => ctx.db.get(id)));
    const sellerById = new Map(sellers.filter(Boolean).map((s) => [s!._id, s!]));

    return {
      category: {
        id: category._id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        image_url: category.image_url,
        icon: category.icon,
      },
      products: products.map((product) => ({
        id: product._id,
        seller_id: product.seller_id,
        title: product.title,
        description: product.description,
        price: product.price,
        image_url: product.image_url,
        category_id: product.category_id,
        created_at: product.created_at
          ? new Date(product.created_at).toISOString()
          : undefined,
        users: sellerById.get(product.seller_id)
          ? {
              full_name:
                sellerById.get(product.seller_id)!.full_name ??
                sellerById.get(product.seller_id)!.name ??
                "",
              avatar_url:
                sellerById.get(product.seller_id)!.avatar_url ??
                sellerById.get(product.seller_id)!.image ??
                null,
            }
          : undefined,
      })),
      pagination: {
        page,
        limit,
        total: all.length,
        pages: Math.max(1, Math.ceil(all.length / limit)),
      },
    };
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    image_url: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const admin = await requireProfile(ctx, userId);
    if (admin.role !== "admin") throw new Error("Admin access only");

    const name = args.name.trim();
    if (!name) throw new Error("Category name is required");

    const slug = slugify(name);
    const existing = await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (existing) throw new Error("A category with that name already exists");

    const count = await ctx.db.query("categories").collect();
    const categoryId = await ctx.db.insert("categories", {
      name,
      slug,
      description: args.description,
      icon: args.icon,
      image_url: args.image_url,
      display_order: count.length,
      is_active: true,
      created_at: Date.now(),
    });

    const category = await ctx.db.get(categoryId);
    return { category };
  },
});

export const setActive = mutation({
  args: { id: v.id("categories"), is_active: v.boolean() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const admin = await requireProfile(ctx, userId);
    if (admin.role !== "admin") throw new Error("Admin access only");

    const category = await ctx.db.get(args.id);
    if (!category) throw new Error("Category not found");
    await ctx.db.patch(args.id, { is_active: args.is_active });
    return { message: args.is_active ? "Category activated" : "Category deactivated" };
  },
});

export const remove = mutation({
  args: { id: v.id("categories") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const admin = await requireProfile(ctx, userId);
    if (admin.role !== "admin") throw new Error("Admin access only");

    // Move orphaned products into the "other" bucket before deleting.
    const fallback = await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", "other"))
      .unique();

    const products = await ctx.db
      .query("products")
      .withIndex("by_category", (q) => q.eq("category_id", args.id))
      .collect();

    for (const product of products) {
      await ctx.db.patch(product._id, { category_id: fallback?._id });
    }

    await ctx.db.delete(args.id);
    return { message: "Category deleted" };
  },
});
