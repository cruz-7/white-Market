import express from "express";

export function buildAdminRouter() {
  const router = express.Router();

  router.get("/dashboard", async (_req, res) => {
    return res.json({ ok: true, section: "admin-dashboard" });
  });

  router.post("/users/:id/promote-seller", async (_req, res) => {
    return res.json({ ok: true });
  });

  return router;
}
