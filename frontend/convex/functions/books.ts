import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireProfile, requireUserId } from "../lib/auth";
import { round2 } from "../lib/money";
import { toIso } from "../lib/shapes";

export const list = query({
  args: {
    book_type: v.optional(v.string()),
    subject: v.optional(v.string()),
    course_code: v.optional(v.string()),
    academic_level: v.optional(v.string()),
    condition: v.optional(v.string()),
    min_price: v.optional(v.number()),
    max_price: v.optional(v.number()),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
    sort: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(100, Math.max(1, args.limit ?? 20));
    const offset = Math.max(0, args.offset ?? 0);

    const all = (await ctx.db.query("books").collect()).filter((book) => {
      if (book.is_active === false || book.is_sold === true) return false;
      if (args.book_type && book.book_type !== args.book_type) return false;
      if (args.academic_level && book.academic_level !== args.academic_level) return false;
      if (args.condition && book.condition !== args.condition) return false;
      if (args.min_price !== undefined && book.price < args.min_price) return false;
      if (args.max_price !== undefined && book.price > args.max_price) return false;
      if (args.subject) {
        const needle = args.subject.toLowerCase();
        if (!book.subject?.toLowerCase().includes(needle)) return false;
      }
      if (args.course_code) {
        const needle = args.course_code.toLowerCase();
        if (!book.course_code?.toLowerCase().includes(needle)) return false;
      }
      if (args.search) {
        const needle = args.search.toLowerCase();
        const haystack = `${book.title} ${book.author ?? ""} ${book.description ?? ""}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });

    const sort = args.sort ?? "newest";
    const sorted = all.sort((a, b) => {
      if (sort === "price_low") return a.price - b.price;
      if (sort === "price_high") return b.price - a.price;
      if (sort === "rating") return (b.rating ?? 0) - (a.rating ?? 0);
      if (sort === "popular") return (b.view_count ?? 0) - (a.view_count ?? 0);
      return (b.created_at ?? 0) - (a.created_at ?? 0);
    });

    const page = sorted.slice(offset, offset + limit);
    const sellerIds = [...new Set(page.map((b) => b.seller_id))];
    const sellers = await Promise.all(sellerIds.map((id) => ctx.db.get(id)));
    const sellerById = new Map(sellers.filter(Boolean).map((s) => [s!._id, s!]));

    return page.map((book) => ({
      id: book._id,
      user_id: book.seller_id,
      seller_id: book.seller_id,
      title: book.title,
      description: book.description,
      isbn: book.isbn,
      author: book.author,
      edition: book.edition,
      publisher: book.publisher,
      book_type: book.book_type,
      subject: book.subject,
      course_code: book.course_code,
      academic_level: book.academic_level,
      condition: book.condition,
      price: book.price,
      price_negotiable: book.price_negotiable ?? true,
      page_count: book.page_count,
      language: book.language ?? "English",
      location: book.location,
      images: book.images ?? [],
      is_active: book.is_active,
      is_sold: book.is_sold,
      view_count: book.view_count ?? 0,
      rating: book.rating ?? 0,
      review_count: book.review_count ?? 0,
      created_at: toIso(book.created_at),
      seller: sellerById.get(book.seller_id)
        ? {
            id: book.seller_id,
            full_name:
              sellerById.get(book.seller_id)!.full_name ??
              sellerById.get(book.seller_id)!.name ??
              "",
            avatar_url: sellerById.get(book.seller_id)!.avatar_url ?? null,
            campus: sellerById.get(book.seller_id)!.campus ?? null,
            role: sellerById.get(book.seller_id)!.role ?? "user",
          }
        : undefined,
    }));
  },
});

export const byId = mutation({
  args: { id: v.id("books") },
  handler: async (ctx, args) => {
    const book = await ctx.db.get(args.id);
    if (!book) throw new Error("Book not found");

    await ctx.db.patch(args.id, { view_count: (book.view_count ?? 0) + 1 });

    const seller = await ctx.db.get(book.seller_id);
    const reviews = await ctx.db
      .query("book_reviews")
      .withIndex("by_book", (q) => q.eq("book_id", args.id))
      .collect();

    const reviewerIds = [...new Set(reviews.map((r) => r.reviewer_id))];
    const reviewers = await Promise.all(reviewerIds.map((id) => ctx.db.get(id)));
    const reviewerById = new Map(reviewers.filter(Boolean).map((r) => [r!._id, r!]));

    return {
      id: book._id,
      user_id: book.seller_id,
      seller_id: book.seller_id,
      title: book.title,
      description: book.description,
      isbn: book.isbn,
      author: book.author,
      book_type: book.book_type,
      subject: book.subject,
      course_code: book.course_code,
      academic_level: book.academic_level,
      condition: book.condition,
      price: book.price,
      price_negotiable: book.price_negotiable ?? true,
      language: book.language ?? "English",
      location: book.location,
      images: book.images ?? [],
      view_count: (book.view_count ?? 0) + 1,
      rating: book.rating ?? 0,
      review_count: book.review_count ?? 0,
      created_at: toIso(book.created_at),
      seller: seller
        ? {
            id: seller._id,
            full_name: seller.full_name ?? seller.name ?? "",
            avatar_url: seller.avatar_url ?? seller.image ?? null,
            campus: seller.campus ?? null,
            role: seller.role ?? "user",
          }
        : undefined,
      reviews: reviews.slice(0, 10).map((review) => ({
        id: review._id,
        rating: review.rating,
        comment: review.comment,
        created_at: toIso(review.created_at),
        reviewer: reviewerById.get(review.reviewer_id)
          ? {
              id: review.reviewer_id,
              full_name:
                reviewerById.get(review.reviewer_id)!.full_name ??
                reviewerById.get(review.reviewer_id)!.name ??
                "",
              avatar_url: reviewerById.get(review.reviewer_id)!.avatar_url ?? null,
            }
          : undefined,
      })),
    };
  },
});

export const byUser = query({
  args: { userId: v.id("users"), limit: v.optional(v.number()), offset: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(100, Math.max(1, args.limit ?? 20));
    const offset = Math.max(0, args.offset ?? 0);

    const books = (await ctx.db
      .query("books")
      .withIndex("by_seller", (q) => q.eq("seller_id", args.userId))
      .collect())
      .filter((book) => book.is_active !== false)
      .sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0));

    return books.slice(offset, offset + limit).map((book) => ({
      id: book._id,
      seller_id: book.seller_id,
      title: book.title,
      author: book.author,
      book_type: book.book_type,
      condition: book.condition,
      price: book.price,
      image_url: book.images?.[0],
      images: book.images ?? [],
      created_at: toIso(book.created_at),
    }));
  },
});

export const metaTypes = query({
  handler: async (ctx) => {
    const all = await ctx.db.query("books").collect();
    return [...new Set(all.map((book) => book.book_type))].filter(Boolean);
  },
});

export const metaSubjects = query({
  handler: async (ctx) => {
    const all = await ctx.db.query("books").collect();
    return [...new Set(all.map((book) => book.subject))].filter(
      (subject): subject is string => !!subject
    );
  },
});

export const create = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireProfile(ctx, userId);

    if (!args.title.trim()) throw new Error("Title is required");
    if (!(args.price > 0)) throw new Error("Price must be greater than 0");

    const now = Date.now();
    const bookId = await ctx.db.insert("books", {
      seller_id: userId,
      title: args.title.trim(),
      description: args.description,
      isbn: args.isbn,
      author: args.author,
      edition: args.edition,
      publisher: args.publisher,
      book_type: args.book_type,
      subject: args.subject,
      course_code: args.course_code,
      academic_level: args.academic_level,
      condition: args.condition,
      price: args.price,
      price_negotiable: args.price_negotiable ?? true,
      page_count: args.page_count,
      language: args.language ?? "English",
      location: args.location,
      images: args.images ?? [],
      is_active: true,
      is_sold: false,
      view_count: 0,
      rating: 0,
      review_count: 0,
      created_at: now,
      updated_at: now,
    });

    const book = await ctx.db.get(bookId);
    return book;
  },
});

export const update = mutation({
  args: {
    id: v.id("books"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    isbn: v.optional(v.string()),
    author: v.optional(v.string()),
    book_type: v.optional(v.string()),
    subject: v.optional(v.string()),
    course_code: v.optional(v.string()),
    academic_level: v.optional(v.string()),
    condition: v.optional(v.string()),
    price: v.optional(v.number()),
    price_negotiable: v.optional(v.boolean()),
    location: v.optional(v.string()),
    images: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const book = await ctx.db.get(args.id);
    if (!book) throw new Error("Book not found");
    if (book.seller_id !== userId) throw new Error("Not authorized");

    const { id, ...rest } = args;
    const patch: Record<string, unknown> = { updated_at: Date.now() };
    for (const [key, value] of Object.entries(rest)) {
      if (value !== undefined) patch[key] = value;
    }
    await ctx.db.patch(id, patch);

    const updated = await ctx.db.get(id);
    return updated;
  },
});

export const remove = mutation({
  args: { id: v.id("books") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const book = await ctx.db.get(args.id);
    if (!book) throw new Error("Book not found");
    if (book.seller_id !== userId) throw new Error("Not authorized");
    await ctx.db.delete(args.id);
    return { message: "Book deleted" };
  },
});

export const markSold = mutation({
  args: { id: v.id("books") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const book = await ctx.db.get(args.id);
    if (!book) throw new Error("Book not found");
    if (book.seller_id !== userId) throw new Error("Not authorized");

    await ctx.db.patch(args.id, { is_sold: true, updated_at: Date.now() });
    const updated = await ctx.db.get(args.id);
    return updated;
  },
});

export const review = mutation({
  args: { id: v.id("books"), rating: v.number(), comment: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireProfile(ctx, userId);

    if (args.rating < 1 || args.rating > 5) {
      throw new Error("Rating must be between 1 and 5");
    }

    const book = await ctx.db.get(args.id);
    if (!book) throw new Error("Book not found");

    const now = Date.now();
    const reviewId = await ctx.db.insert("book_reviews", {
      book_id: args.id,
      reviewer_id: userId,
      seller_id: book.seller_id,
      rating: args.rating,
      comment: args.comment,
      created_at: now,
    });

    const reviews = await ctx.db
      .query("book_reviews")
      .withIndex("by_book", (q) => q.eq("book_id", args.id))
      .collect();
    const rating = round2(
      reviews.reduce((sum, r) => sum + r.rating, 0) / Math.max(1, reviews.length)
    );
    await ctx.db.patch(args.id, { rating, review_count: reviews.length });

    const review = await ctx.db.get(reviewId);
    return review;
  },
});
