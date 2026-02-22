/**
 * Example admin guard middleware.
 * Enforces server-side role check against database.
 */
export function requireAdmin(supabase) {
  return async (req, res, next) => {
    if (!req.user?.id) return res.status(401).json({ error: "unauthenticated" });

    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", req.user.id)
      .maybeSingle();

    if (error || !data) return res.status(403).json({ error: "forbidden" });
    if (data.role !== "admin") return res.status(403).json({ error: "forbidden" });

    return next();
  };
}
