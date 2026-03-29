import { Router } from "express";
import { billingController } from "../controllers/billing.controller";
import { authenticate } from "../middleware/auth.middleware";
import { requireTenant } from "../middleware/tenant.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

// Public — list plans (no auth needed for marketing page)
router.get("/plans", billingController.listPlans.bind(billingController));

// Authenticated routes
router.use(authenticate, requireTenant);

router.get("/subscription",  billingController.getSubscription.bind(billingController));
router.get("/usage",         billingController.getUsage.bind(billingController));
router.get("/history",       billingController.getBillingHistory.bind(billingController));

// Plan change — owner only
router.post("/change-plan", requireRole("owner"), billingController.changePlan.bind(billingController));

export default router;
