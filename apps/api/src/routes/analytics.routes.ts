import { Router, Request, Response, NextFunction } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requireTenant } from "../middleware/tenant.middleware";
import { analyticsService } from "../services/analytics.service";

const router = Router();
router.use(authenticate, requireTenant);

router.get("/dashboard", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const stats = await analyticsService.getDashboardStats(req.restaurantId!, Math.min(days, 90));
    res.json({ success: true, data: stats });
  } catch (err) { next(err); }
});

export default router;
