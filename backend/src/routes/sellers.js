import { Router } from "express";
import { supabase } from "../lib/supabaseClient.js";

const sellersRouter = Router();

sellersRouter.get("/", async (_req, res) => {
  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, momo_provider, created_at")
    .eq("role", "seller")
    .order("created_at", { ascending: false });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.json({ sellers: data || [] });
});

export default sellersRouter;
