import express from "express";
import { createClient } from "@supabase/supabase-js";
import { requireAuth } from "./middleware/auth.js";
import { requireAdmin } from "./middleware/admin.js";
import { buildAdminRouter } from "./routes/admin.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

// Protect all admin routes server-side only.
app.use("/admin", requireAuth(supabase), requireAdmin(supabase), buildAdminRouter());

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`API listening on :${port}`);
});
