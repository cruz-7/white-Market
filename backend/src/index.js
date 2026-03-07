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

function parseOrigins(originsInput) {
  if (Array.isArray(originsInput)) {
    return originsInput.map((value) => String(value).trim()).filter(Boolean);
  }

  return String(originsInput || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function validateRequiredEnv(isProduction) {
  if (!isProduction) return;

  const requiredEnv = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_ANON_KEY",
    "FRONTEND_URL",
    "PAYSTACK_SECRET_KEY",
    "PAYMENT_WEBHOOK_SECRET",
  ];
  const missing = requiredEnv.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables for production: ${missing.join(", ")}`);
  }
}

export function createApp(options = {}) {
  const app = express();
  const isProduction = options.isProduction ?? process.env.NODE_ENV === "production";
  const configuredOrigins = parseOrigins(options.frontendOrigins ?? process.env.FRONTEND_URL);
  const enableTestRoutes = options.enableTestRoutes ?? (!isProduction && process.env.ENABLE_TEST_ROUTES !== "false");
  const validateEnv = options.validateEnv ?? true;

  if (validateEnv) {
    validateRequiredEnv(isProduction);
  }

  app.disable("x-powered-by");

  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        // Allow non-browser clients and same-origin requests without Origin header.
        if (!origin) {
          return callback(null, true);
        }

        if (!isProduction) {
          return callback(null, true);
        }

        if (configuredOrigins.includes(origin)) {
          return callback(null, true);
        }

        return callback(new Error("CORS origin denied"));
      },
    }),
  );
  // Webhook endpoints require raw payload for signature verification.
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
