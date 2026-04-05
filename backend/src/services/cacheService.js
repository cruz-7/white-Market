import NodeCache from "node-cache";

const cache = new NodeCache({
  stdTTL: 300, // 5 minutes default
  checkperiod: 60, // Check for expired keys every 60 seconds
  useClones: false, // Store references to improve performance
});

export const cacheKeys = {
  products: (params = "") => `products:${params}`,
  product: (id) => `product:${id}`,
  categories: "categories:all",
  category: (id) => `category:${id}`,
  trendingProducts: "products:trending",
  user: (id) => `user:${id}`,
  wallet: (id) => `wallet:${id}`,
  sellerProfile: (id) => `seller:${id}`,
  sellerProducts: (id) => `seller:${id}:products`,
  searchSuggestions: (query) => `search:${query}`,
};

export const cacheMiddleware = (ttl = 300) => {
  return (req, res, next) => {
    const key = req.originalUrl || req.url;
    const cached = cache.get(key);
    
    if (cached) {
      return res.status(200).json(cached);
    }
    
    // Override res.json to cache the response
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      if (res.statusCode === 200 && !req.method.toUpperCase().includes("POST")) {
        cache.set(key, data, ttl);
      }
      return originalJson(data);
    };
    
    next();
  };
};

export const clearCache = (pattern) => {
  if (!pattern) {
    cache.flushAll();
    return;
  }
  
  const keys = cache.keys();
  const regex = new RegExp(pattern);
  keys.forEach((key) => {
    if (regex.test(key)) {
      cache.del(key);
    }
  });
};

export const invalidateProductCache = (productId) => {
  clearCache("products:");
  if (productId) {
    clearCache(`product:${productId}`);
  }
};

export const invalidateUserCache = (userId) => {
  if (userId) {
    clearCache(`user:${userId}`);
    clearCache(`wallet:${userId}`);
    clearCache(`seller:${userId}`);
  }
};

export default cache;