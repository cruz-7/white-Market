import { supabase } from "../lib/supabaseClient.js";

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Missing or invalid Authorization header" });
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  // fetch role from users table
  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role")
    .eq("id", data.user.id)
    .single();

  req.user = data.user;
  req.user.role = profile?.role || "user";

  if (profileError && profileError.code !== "PGRST116") {
    console.error("Failed to load user role:", profileError.message);
  }

  if (req.user.role === "banned") {
    return res.status(403).json({ message: "Account is banned" });
  }

  return next();
}
