/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as functions_account from "../functions/account.js";
import type * as functions_admin from "../functions/admin.js";
import type * as functions_books from "../functions/books.js";
import type * as functions_categories from "../functions/categories.js";
import type * as functions_fashion from "../functions/fashion.js";
import type * as functions_favorites from "../functions/favorites.js";
import type * as functions_feedback from "../functions/feedback.js";
import type * as functions_messages from "../functions/messages.js";
import type * as functions_notifications from "../functions/notifications.js";
import type * as functions_orders from "../functions/orders.js";
import type * as functions_payments from "../functions/payments.js";
import type * as functions_payouts from "../functions/payouts.js";
import type * as functions_products from "../functions/products.js";
import type * as functions_profile from "../functions/profile.js";
import type * as functions_ratings from "../functions/ratings.js";
import type * as functions_referrals from "../functions/referrals.js";
import type * as functions_reviews from "../functions/reviews.js";
import type * as functions_search from "../functions/search.js";
import type * as functions_sellers from "../functions/sellers.js";
import type * as functions_services from "../functions/services.js";
import type * as functions_verification from "../functions/verification.js";
import type * as functions_wallet from "../functions/wallet.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_ids from "../lib/ids.js";
import type * as lib_money from "../lib/money.js";
import type * as lib_paystack from "../lib/paystack.js";
import type * as lib_shapes from "../lib/shapes.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  "functions/account": typeof functions_account;
  "functions/admin": typeof functions_admin;
  "functions/books": typeof functions_books;
  "functions/categories": typeof functions_categories;
  "functions/fashion": typeof functions_fashion;
  "functions/favorites": typeof functions_favorites;
  "functions/feedback": typeof functions_feedback;
  "functions/messages": typeof functions_messages;
  "functions/notifications": typeof functions_notifications;
  "functions/orders": typeof functions_orders;
  "functions/payments": typeof functions_payments;
  "functions/payouts": typeof functions_payouts;
  "functions/products": typeof functions_products;
  "functions/profile": typeof functions_profile;
  "functions/ratings": typeof functions_ratings;
  "functions/referrals": typeof functions_referrals;
  "functions/reviews": typeof functions_reviews;
  "functions/search": typeof functions_search;
  "functions/sellers": typeof functions_sellers;
  "functions/services": typeof functions_services;
  "functions/verification": typeof functions_verification;
  "functions/wallet": typeof functions_wallet;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  "lib/ids": typeof lib_ids;
  "lib/money": typeof lib_money;
  "lib/paystack": typeof lib_paystack;
  "lib/shapes": typeof lib_shapes;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
