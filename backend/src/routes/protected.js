import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";

const protectedRouter = Router();

protectedRouter.get("/protected/me", requireAuth, (req, res) => {
  return res.json({
    message: "Token is valid",
    user: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.user_metadata?.role || "user",
    },
  });
});

export default protectedRouter;
