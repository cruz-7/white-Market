export type UserRole = "user" | "seller" | "admin";

export type LocalUser = {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  avatar_url?: string;
  momo_number?: string;
};

export type Product = {
  id: string;
  title: string;
  price: number;
  sellerId: string;
  sellerName: string;
  category: string;
  image: string;
  is_active: boolean;
  stock_status: "in_stock" | "limited" | "out_of_stock";
  views: number;
  rating: number;
  reviews: number;
  eta: string;
  delivery_type: "Pickup" | "Delivery" | "Pickup or Delivery";
  condition: "New" | "Like New" | "Used";
  verified_seller: boolean;
  seller_sales: number;
  response_time: string;
  listed_at: string;
};

export type OrderStatus = "pending" | "confirmed" | "shipped" | "delivered" | "completed" | "disputed";

export type Order = {
  id: string;
  productId: string;
  productTitle: string;
  productImage: string;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  sellerName: string;
  amount: number;
  status: OrderStatus;
  created_at: string;
  reviewed?: boolean;
};

export type Conversation = {
  id: string;
  productId: string;
  productTitle: string;
  productImage: string;
  buyerId: string;
  sellerId: string;
  buyerName: string;
  sellerName: string;
  updated_at: string;
  typingBy?: string;
};

export type MessageStatus = "sent" | "delivered" | "read";

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  text?: string;
  imageUrl?: string;
  created_at: string;
  status: MessageStatus;
};

export type Wallet = {
  user_id: string;
  balance: number;
  pending_earnings: number;
  currency: "GHS";
  updated_at: string;
};

export type WalletTransactionType = "credit" | "debit" | "withdrawal" | "refund" | "pending";

export type WalletTransaction = {
  id: string;
  user_id: string;
  type: WalletTransactionType;
  amount: number;
  description: string;
  reference_id?: string;
  balance_after: number;
  created_at: string;
};

const KEYS = {
  users: "wm_users",
  products: "wm_products",
  orders: "wm_orders",
  conversations: "wm_conversations",
  messages: "wm_messages",
  wallets: "wm_wallets",
  walletTransactions: "wm_wallet_transactions",
  activities: "wm_activities",
  seeded: "wm_seeded",
};

const bc = typeof window !== "undefined" && "BroadcastChannel" in window ? new BroadcastChannel("wm-realtime") : null;

function write<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event("wm-data-change"));
  bc?.postMessage({ type: "data-change" });
}

function read<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function rid(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function seedData() {
  const SEED_VERSION = "2";
  if (localStorage.getItem(KEYS.seeded) === SEED_VERSION) return;

  const users: LocalUser[] = [
    { id: "u_seller_1", full_name: "Nana Mensah", email: "nana@seller.local", role: "seller", momo_number: "0240000001" },
    { id: "u_seller_2", full_name: "Kojo Asante", email: "kojo@seller.local", role: "seller", momo_number: "0240000003" },
    { id: "u_seller_3", full_name: "Efua Addo", email: "efua@seller.local", role: "seller", momo_number: "0240000004" },
    { id: "u_student_1", full_name: "Ama Boateng", email: "ama@student.local", role: "user", momo_number: "0240000002" },
  ];

  const products: Product[] = [
    { id: "p1", title: "Homemade Jollof Bowl", price: 25, sellerId: "u_seller_1", sellerName: "Nana Mensah", category: "Food", image: "https://images.unsplash.com/photo-1516684732162-798a0062be99?w=500&q=80", is_active: true, stock_status: "in_stock", views: 321, rating: 4.8, reviews: 96, eta: "20-35 min", delivery_type: "Pickup or Delivery", condition: "New", verified_seller: true, seller_sales: 142, response_time: "~8 min", listed_at: new Date(Date.now() - 2 * 86400000).toISOString() },
    { id: "p2", title: "Beaded Bracelet Set", price: 18, sellerId: "u_seller_1", sellerName: "Nana Mensah", category: "Accessories", image: "https://images.unsplash.com/photo-1617038220319-276d3cfab638?w=500&q=80", is_active: true, stock_status: "limited", views: 128, rating: 4.6, reviews: 41, eta: "Same day pickup", delivery_type: "Pickup", condition: "New", verified_seller: true, seller_sales: 142, response_time: "~8 min", listed_at: new Date(Date.now() - 4 * 86400000).toISOString() },
    { id: "p3", title: "Adjustable Laptop Stand", price: 90, sellerId: "u_seller_2", sellerName: "Kojo Asante", category: "Electronics", image: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=500&q=80", is_active: true, stock_status: "in_stock", views: 74, rating: 4.7, reviews: 28, eta: "1-2 days", delivery_type: "Delivery", condition: "Like New", verified_seller: true, seller_sales: 67, response_time: "~15 min", listed_at: new Date(Date.now() - 1 * 86400000).toISOString() },
    { id: "p4", title: "Graphing Calculator (Used)", price: 120, sellerId: "u_seller_2", sellerName: "Kojo Asante", category: "Electronics", image: "https://images.unsplash.com/photo-1509228468518-180dd4864904?w=500&q=80", is_active: true, stock_status: "limited", views: 87, rating: 4.4, reviews: 15, eta: "Same day meetup", delivery_type: "Pickup", condition: "Used", verified_seller: true, seller_sales: 67, response_time: "~15 min", listed_at: new Date(Date.now() - 7 * 86400000).toISOString() },
    { id: "p5", title: "Natural Shea Body Butter", price: 30, sellerId: "u_seller_3", sellerName: "Efua Addo", category: "Beauty", image: "https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=500&q=80", is_active: true, stock_status: "in_stock", views: 205, rating: 4.9, reviews: 112, eta: "24 hours", delivery_type: "Pickup or Delivery", condition: "New", verified_seller: false, seller_sales: 39, response_time: "~20 min", listed_at: new Date(Date.now() - 3 * 86400000).toISOString() },
    { id: "p6", title: "Campus Tote Bag", price: 45, sellerId: "u_seller_3", sellerName: "Efua Addo", category: "Accessories", image: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=500&q=80", is_active: true, stock_status: "out_of_stock", views: 66, rating: 4.5, reviews: 22, eta: "2-3 days", delivery_type: "Delivery", condition: "New", verified_seller: false, seller_sales: 39, response_time: "~20 min", listed_at: new Date(Date.now() - 10 * 86400000).toISOString() },
  ];

  const orders: Order[] = [
    { id: "o101", productId: "p1", productTitle: "Homemade Jollof Bowl", productImage: products[0].image, buyerId: "u_student_1", buyerName: "Ama Boateng", sellerId: "u_seller_1", sellerName: "Nana Mensah", amount: 50, status: "confirmed", created_at: new Date(Date.now() - 86400000).toISOString() },
    { id: "o102", productId: "p2", productTitle: "Beaded Bracelet Set", productImage: products[1].image, buyerId: "u_student_1", buyerName: "Ama Boateng", sellerId: "u_seller_1", sellerName: "Nana Mensah", amount: 18, status: "completed", created_at: new Date(Date.now() - 172800000).toISOString(), reviewed: false },
  ];

  const conversations: Conversation[] = [
    {
      id: "c1",
      productId: "p1",
      productTitle: "Homemade Jollof Bowl",
      productImage: products[0].image,
      buyerId: "u_student_1",
      sellerId: "u_seller_1",
      buyerName: "Ama Boateng",
      sellerName: "Nana Mensah",
      updated_at: new Date(Date.now() - 500000).toISOString(),
    },
  ];

  const messages: Message[] = [
    { id: "m1", conversationId: "c1", senderId: "u_student_1", text: "Hi, is this still available?", created_at: new Date(Date.now() - 7200000).toISOString(), status: "read" },
    { id: "m2", conversationId: "c1", senderId: "u_seller_1", text: "Yes, available now.", created_at: new Date(Date.now() - 7100000).toISOString(), status: "read" },
    { id: "m3", conversationId: "c1", senderId: "u_seller_1", text: "Can deliver to Commonwealth Hall.", created_at: new Date(Date.now() - 300000).toISOString(), status: "delivered" },
  ];

  const wallets: Wallet[] = [
    { user_id: "u_student_1", balance: 240, pending_earnings: 0, currency: "GHS", updated_at: new Date().toISOString() },
    { user_id: "u_seller_1", balance: 180, pending_earnings: 45, currency: "GHS", updated_at: new Date().toISOString() },
  ];

  const tx: WalletTransaction[] = [
    { id: rid("t"), user_id: "u_student_1", type: "credit", amount: 300, description: "Initial top up", balance_after: 300, created_at: new Date(Date.now() - 259200000).toISOString() },
    { id: rid("t"), user_id: "u_student_1", type: "debit", amount: 60, description: "Order payment #o100", balance_after: 240, reference_id: "o100", created_at: new Date(Date.now() - 172800000).toISOString() },
    { id: rid("t"), user_id: "u_seller_1", type: "pending", amount: 45, description: "Completed order hold #o102", balance_after: 180, reference_id: "o102", created_at: new Date(Date.now() - 86400000).toISOString() },
  ];

  write(KEYS.users, users);
  write(KEYS.products, products);
  write(KEYS.orders, orders);
  write(KEYS.conversations, conversations);
  write(KEYS.messages, messages);
  write(KEYS.wallets, wallets);
  write(KEYS.walletTransactions, tx);
  write(KEYS.activities, [
    { id: rid("a"), icon: "package", text: "Nana listed a new product", time: new Date(Date.now() - 120000).toISOString() },
    { id: rid("a"), icon: "wallet", text: "Payment of GHS 45 received", time: new Date(Date.now() - 320000).toISOString() },
    { id: rid("a"), icon: "alert", text: "Dispute raised on Order #o102", time: new Date(Date.now() - 640000).toISOString() },
  ]);

  localStorage.setItem(KEYS.seeded, SEED_VERSION);
}

export function getUsers() { return read<LocalUser[]>(KEYS.users, []); }
export function getProducts() { return read<Product[]>(KEYS.products, []); }
export function getOrders() { return read<Order[]>(KEYS.orders, []); }
export function getConversations() { return read<Conversation[]>(KEYS.conversations, []); }
export function getMessages() { return read<Message[]>(KEYS.messages, []); }
export function getActivities() { return read<any[]>(KEYS.activities, []); }

export function saveProducts(products: Product[]) { write(KEYS.products, products); }
export function saveOrders(orders: Order[]) { write(KEYS.orders, orders); }

export function getWallet(userId: string): Wallet {
  const wallets = read<Wallet[]>(KEYS.wallets, []);
  const existing = wallets.find((w) => w.user_id === userId);
  if (existing) return existing;
  const created: Wallet = { user_id: userId, balance: 0, pending_earnings: 0, currency: "GHS", updated_at: new Date().toISOString() };
  wallets.push(created);
  write(KEYS.wallets, wallets);
  return created;
}

function saveWallet(wallet: Wallet) {
  const wallets = read<Wallet[]>(KEYS.wallets, []);
  const idx = wallets.findIndex((w) => w.user_id === wallet.user_id);
  if (idx > -1) wallets[idx] = wallet;
  else wallets.push(wallet);
  write(KEYS.wallets, wallets);
}

export function getWalletTransactions(userId: string) {
  return read<WalletTransaction[]>(KEYS.walletTransactions, []).filter((t) => t.user_id === userId).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
}

function addWalletTransaction(tx: Omit<WalletTransaction, "id" | "created_at">) {
  const all = read<WalletTransaction[]>(KEYS.walletTransactions, []);
  all.push({ ...tx, id: rid("t"), created_at: new Date().toISOString() });
  write(KEYS.walletTransactions, all);
}

export function topUpWallet(userId: string, amount: number, description = "Wallet top up") {
  const wallet = getWallet(userId);
  const next = { ...wallet, balance: wallet.balance + amount, updated_at: new Date().toISOString() };
  saveWallet(next);
  addWalletTransaction({ user_id: userId, type: "credit", amount, description, balance_after: next.balance });
}

export function withdrawWallet(userId: string, amount: number, description = "Withdrawal request") {
  const wallet = getWallet(userId);
  if (wallet.balance < amount) return false;
  const next = { ...wallet, balance: wallet.balance - amount, updated_at: new Date().toISOString() };
  saveWallet(next);
  addWalletTransaction({ user_id: userId, type: "withdrawal", amount, description, balance_after: next.balance });
  return true;
}

export function debitWallet(userId: string, amount: number, description: string, reference_id?: string) {
  const wallet = getWallet(userId);
  if (wallet.balance < amount) return false;
  const next = { ...wallet, balance: wallet.balance - amount, updated_at: new Date().toISOString() };
  saveWallet(next);
  addWalletTransaction({ user_id: userId, type: "debit", amount, description, reference_id, balance_after: next.balance });
  return true;
}

export function creditPendingEarnings(userId: string, amount: number, reference_id?: string) {
  const wallet = getWallet(userId);
  const next = { ...wallet, pending_earnings: wallet.pending_earnings + amount, updated_at: new Date().toISOString() };
  saveWallet(next);
  addWalletTransaction({ user_id: userId, type: "pending", amount, description: "Completed order in 24h hold", reference_id, balance_after: next.balance });
}

export function releasePendingEarnings(userId: string) {
  const wallet = getWallet(userId);
  if (wallet.pending_earnings <= 0) return;
  const amount = wallet.pending_earnings;
  const next = { ...wallet, balance: wallet.balance + amount, pending_earnings: 0, updated_at: new Date().toISOString() };
  saveWallet(next);
  addWalletTransaction({ user_id: userId, type: "credit", amount, description: "Pending earnings released", balance_after: next.balance });
}

export function upsertUser(user: LocalUser) {
  const users = read<LocalUser[]>(KEYS.users, []);
  const idx = users.findIndex((u) => u.id === user.id);
  if (idx > -1) users[idx] = user;
  else users.push(user);
  write(KEYS.users, users);
}

export function upsertConversationForProduct(input: {
  productId: string;
  buyerId: string;
  sellerId: string;
  buyerName: string;
  sellerName: string;
  productTitle: string;
  productImage: string;
}): Conversation {
  const list = getConversations();
  const existing = list.find((c) => c.productId === input.productId && c.buyerId === input.buyerId && c.sellerId === input.sellerId);
  if (existing) return existing;
  const created: Conversation = {
    id: rid("c"),
    productId: input.productId,
    productTitle: input.productTitle,
    productImage: input.productImage,
    buyerId: input.buyerId,
    sellerId: input.sellerId,
    buyerName: input.buyerName,
    sellerName: input.sellerName,
    updated_at: new Date().toISOString(),
  };
  write(KEYS.conversations, [created, ...list]);
  return created;
}

export function sendMessage(params: { conversationId: string; senderId: string; text?: string; imageUrl?: string }) {
  if (!params.text && !params.imageUrl) return;
  const messages = getMessages();
  const message: Message = {
    id: rid("m"),
    conversationId: params.conversationId,
    senderId: params.senderId,
    text: params.text,
    imageUrl: params.imageUrl,
    created_at: new Date().toISOString(),
    status: "sent",
  };
  write(KEYS.messages, [...messages, message]);

  setTimeout(() => {
    const next = getMessages().map((m) => (m.id === message.id ? { ...m, status: "delivered" as const } : m));
    write(KEYS.messages, next);
  }, 600);

  const conversations = getConversations().map((c) =>
    c.id === params.conversationId ? { ...c, updated_at: message.created_at, typingBy: undefined } : c,
  );
  write(KEYS.conversations, conversations);
}

export function setTyping(conversationId: string, userId: string, isTyping: boolean) {
  const next = getConversations().map((c) =>
    c.id === conversationId ? { ...c, typingBy: isTyping ? userId : undefined } : c,
  );
  write(KEYS.conversations, next);
}

export function markConversationRead(conversationId: string, viewerId: string) {
  const next = getMessages().map((m) =>
    m.conversationId === conversationId && m.senderId !== viewerId ? { ...m, status: "read" as const } : m,
  );
  write(KEYS.messages, next);
}

export function getUnreadCount(userId: string) {
  const conversations = getConversations().filter((c) => c.buyerId === userId || c.sellerId === userId);
  const allowed = new Set(conversations.map((c) => c.id));
  return getMessages().filter((m) => allowed.has(m.conversationId) && m.senderId !== userId && m.status !== "read").length;
}

export function subscribeDataChange(cb: () => void) {
  const handler = () => cb();
  window.addEventListener("wm-data-change", handler);
  const bcHandler = () => cb();
  bc?.addEventListener("message", bcHandler);
  return () => {
    window.removeEventListener("wm-data-change", handler);
    bc?.removeEventListener("message", bcHandler);
  };
}

export function recordActivity(text: string, icon = "dot") {
  const acts = getActivities();
  const next = [{ id: rid("a"), text, icon, time: new Date().toISOString() }, ...acts].slice(0, 10);
  write(KEYS.activities, next);
}

export function timeAgo(iso: string) {
  const ms = Date.now() - +new Date(iso);
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  if (hours < 48) return "Yesterday";
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short" });
}
