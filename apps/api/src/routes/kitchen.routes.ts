import { Router } from "express";
import { kitchenController } from "../controllers/kitchen.controller";
import { authenticate } from "../middleware/auth.middleware";
import { requireTenant } from "../middleware/tenant.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();
router.use(authenticate, requireTenant);

// Kitchen role can access all these — staff and above also can
router.get("/orders",                                     kitchenController.listOrders.bind(kitchenController));
router.get("/stats",                                      kitchenController.getStats.bind(kitchenController));
router.patch("/orders/:orderId/items/:itemId",  requireRole("kitchen"), kitchenController.updateItemStatus.bind(kitchenController));
router.patch("/orders/:orderId/bump",           requireRole("kitchen"), kitchenController.bumpOrder.bind(kitchenController));

export default router;
