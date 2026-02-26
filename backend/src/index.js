import cors from "cors";
import express from "express";
import authRouter from "./routes/auth.js";
import ordersRouter from "./routes/orders.js";
import paymentsRouter from "./routes/payments.js";
import payoutsRouter from "./routes/payouts.js";
import protectedRouter from "./routes/protected.js";
import profileRouter from "./routes/profile.js";
import productsRouter from "./routes/products.js";
import sellersRouter from "./routes/sellers.js";
import adminRouter from "./routes/admin.js";
import testRouter from "./routes/test.js";

const app = express();

app.use(cors());
// Webhook endpoints require raw payload for signature verification.
app.use("/payments/webhook", express.raw({ type: "application/json" }));
app.use(express.json());

app.get("/", (_req, res) => {
  res.send("White Market backend is running");
});

app.use("/auth", authRouter);
app.use("/protected", protectedRouter);
app.use("/protected", profileRouter);
app.use("/products", productsRouter);
app.use("/orders", ordersRouter);
app.use("/payments", paymentsRouter);
app.use("/payouts", payoutsRouter);
app.use("/sellers", sellersRouter);
app.use("/admin", adminRouter);
app.use(testRouter);

const PORT = Number(process.env.PORT || 5000);

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
