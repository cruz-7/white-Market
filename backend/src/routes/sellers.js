import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";

const sellersRouter = Router();

sellersRouter.get("/", requireAuth, (_req, res) => {
  return res.json({ message: "Sellers route scaffolded" });
});

export default sellersRouter;
