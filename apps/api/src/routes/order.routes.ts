import { Router } from "express";
import { orderController } from "../controllers/order.controller";
import { authenticate } from "../middleware/auth.middleware";
import { requireTenant } from "../middleware/tenant.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();
router.use(authenticate, requireTenant);

// Stats — must come before /:id to avoid param conflict
router.get("/stats",                    orderController.getStats.bind(orderController));

// List orders (with optional ?status= filter)
router.get("/",                         orderController.listOrders.bind(orderController));

// Get single order
router.get("/:id",                      orderController.getOrder.bind(orderController));

// Update status — staff can confirm/serve, kitchen can mark preparing/ready
router.patch("/:id/status", requireRole("staff"), orderController.updateStatus.bind(orderController));

export default router;
