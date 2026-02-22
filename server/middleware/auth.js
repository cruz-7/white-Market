/**
 * Example auth middleware for server routes.
 * Assumption: JWT is a Supabase access token.
 */
export function requireAuth(supabase) {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization || "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
      if (!token) return res.status(403).json({ error: "forbidden" });

      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data?.user) return res.status(403).json({ error: "forbidden" });

      req.user = data.user;
      next();
    } catch {
      return res.status(403).json({ error: "forbidden" });
    }
  };
}
