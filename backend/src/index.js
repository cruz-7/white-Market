import cors from "cors";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import authRouter from "./routes/auth.js";
import ordersRouter from "./routes/orders.js";
import paymentsRouter from "./routes/payments.js";
import payoutsRouter from "./routes/payouts.js";
import messagesRouter from "./routes/messages.js";
import protectedRouter from "./routes/protected.js";
import profileRouter from "./routes/profile.js";
import productsRouter from "./routes/products.js";
import sellersRouter from "./routes/sellers.js";
import adminRouter from "./routes/admin.js";
import testRouter from "./routes/test.js";
import verificationRouter from "./routes/verification.js";
import categoriesRouter from "./routes/categories.js";
import reviewsRouter from "./routes/reviews.js";
import favoritesRouter from "./routes/favorites.js";
import searchRouter from "./routes/search.js";
import referralsRouter from "./routes/referrals.js";
import notificationsRouter from "./routes/notifications.js";
import servicesRouter from "./routes/services.js";
import booksRouter from "./routes/books.js";
import fashionRouter from "./routes/fashion.js";
import ratingsRouter from "./routes/ratings.js";

function parseOrigins(originsInput) {
  if (Array.isArray(originsInput)) {
    return originsInput.map((value) => String(value).trim()).filter(Boolean);
  }

  return String(originsInput || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizeOrigin(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  // Accept full URLs (even with paths/trailing slashes) and normalize to origin.
  // Example: "https://example.com/app/" -> "https://example.com"
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw)) {
    try {
      return new URL(raw).origin;
    } catch {
      return raw.replace(/\/+$/, "");
    }
  }

  // For already-normalized origins, just strip trailing slashes.
  return raw.replace(/\/+$/, "");
}

function validateRequiredEnv(isProduction) {
  if (!isProduction) return;

  const requiredEnv = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_ANON_KEY",
    "FRONTEND_URL",
    "PAYSTACK_SECRET_KEY",
    "PAYSTACK_CALLBACK_URL",
  ];
  const missing = requiredEnv.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables for production: ${missing.join(", ")}`);
  }
}

function createIpRateLimiter({ windowMs, maxRequests, message }) {
  const hits = new Map();
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of hits.entries()) {
      if (entry.resetAt <= now) {
        hits.delete(ip);
      }
    }
  }, Math.max(60_000, Math.floor(windowMs / 2)));
  if (typeof cleanup.unref === "function") {
    cleanup.unref();
  }

  return (req, res, next) => {
    const now = Date.now();
    const forwardedFor = req.headers["x-forwarded-for"];
    const ip =
      typeof forwardedFor === "string"
        ? forwardedFor.split(",")[0].trim()
        : req.ip || req.socket?.remoteAddress || "unknown";

    let entry = hits.get(ip);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(ip, entry);
    }

    entry.count += 1;
    res.setHeader("RateLimit-Limit", String(maxRequests));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, maxRequests - entry.count)));
    res.setHeader("RateLimit-Reset", String(Math.ceil((entry.resetAt - now) / 1000)));

    if (entry.count > maxRequests) {
      return res.status(429).json({ error: message || "Too many requests. Please try again later." });
    }

    return next();
  };
}

export function createApp(options = {}) {
  const app = express();
  const isProduction = options.isProduction ?? process.env.NODE_ENV === "production";
  const configuredOrigins = parseOrigins(options.frontendOrigins ?? process.env.FRONTEND_URL);
  const allowedOrigins = configuredOrigins.map(normalizeOrigin).filter(Boolean);
  const enableTestRoutes = options.enableTestRoutes ?? (!isProduction && process.env.ENABLE_TEST_ROUTES !== "false");
  const validateEnv = options.validateEnv ?? true;

  if (validateEnv) {
    validateRequiredEnv(isProduction);
  }

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  const globalRateLimiter = createIpRateLimiter({
    windowMs: 15 * 60 * 1000,
    maxRequests: isProduction ? 300 : 5000,
  });
  const authRateLimiter = createIpRateLimiter({
    windowMs: 15 * 60 * 1000,
    maxRequests: isProduction ? 30 : 300,
    message: "Too many authentication attempts. Please try again later.",
  });

  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    if (isProduction) {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    return next();
  });

  const corsOptions = {
    credentials: true,
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (!isProduction) {
        return callback(null, true);
      }

      const normalizedOrigin = normalizeOrigin(origin);
      if (allowedOrigins.includes(normalizedOrigin)) {
        return callback(null, true);
      }

      return callback(new Error("CORS origin denied"));
    },
  };

  app.use(cors(corsOptions));
  // Ensure browsers' CORS preflights get a successful response.
  app.options(/.*/, cors(corsOptions));

  app.use(globalRateLimiter);
  app.use("/auth", authRateLimiter);
  app.use("/payments/webhook", express.raw({ type: "application/json" }));
  app.use(express.json());

  app.get("/", (_req, res) => {
    res.send("White Market backend is running");
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/auth", authRouter);
  app.use("/protected", protectedRouter);
  app.use("/protected", profileRouter);
  app.use("/products", productsRouter);
  app.use("/orders", ordersRouter);
  app.use("/payments", paymentsRouter);
  app.use("/payouts", payoutsRouter);
  app.use("/messages", messagesRouter);
  app.use("/sellers", sellersRouter);
  app.use("/admin", adminRouter);
  app.use("/verification", verificationRouter);
  app.use("/categories", categoriesRouter);
  app.use("/reviews", reviewsRouter);
  app.use("/favorites", favoritesRouter);
  app.use("/search", searchRouter);
  app.use("/referrals", referralsRouter);
  app.use("/notifications", notificationsRouter);
  app.use("/services", servicesRouter);
  app.use("/books", booksRouter);
  app.use("/fashion", fashionRouter);
  app.use("/ratings", ratingsRouter);

  if (enableTestRoutes) {
    app.use(testRouter);
  }

  app.use((_req, res) => {
    res.status(404).json({ error: "Route not found" });
  });

  app.use((err, _req, res, _next) => {
    if (err?.message === "CORS origin denied") {
      return res.status(403).json({ error: "CORS blocked this origin" });
    }

    console.error("Unhandled server error:", err);
    return res.status(500).json({ error: "Internal server error" });
  });

  return app;
}

export function startServer(options = {}) {
  const app = options.app || createApp(options);
  const port = Number(options.port || process.env.PORT || 5000);
  return app.listen(port, () => {
    console.log(`Backend running on port ${port}`);
  });
}

const currentFilePath = fileURLToPath(import.meta.url);
const isDirectExecution = process.argv[1] && path.resolve(process.argv[1]) === currentFilePath;

if (isDirectExecution) {
  startServer();
}

export default createApp;
