import { Router, Request, Response, NextFunction } from "express";
import { tableService } from "../services/table.service";
import { orderController } from "../controllers/order.controller";
import { query } from "../db/pool";

const router = Router();

/**
 * GET /api/v1/diner/scan/:token
 * Public — QR scan, creates session, returns restaurant + table + menu.
 */
router.get("/scan/:token", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await tableService.handleQrScan(req.params.token, {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * GET /api/v1/diner/menu/:token
 * Public — return menu for an existing session token (for refresh).
 */
router.get("/menu/:token", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const table = await tableService.getTableByToken(req.params.token);
    if (!table) {
      res.status(404).json({ success: false, error: "NOT_FOUND", message: "Table not found" });
      return;
    }
    const result = await tableService.handleQrScan(req.params.token, {});
    res.json({ success: true, data: { menu: result.menu, restaurant: result.restaurant } });
  } catch (err) { next(err); }
});

/**
 * POST /api/v1/diner/:restaurantId/orders
 * Public — place a new order from a diner session.
 */
router.post(
  "/:restaurantId/orders",
  orderController.placeOrder.bind(orderController)
);

/**
 * GET /api/v1/diner/:restaurantId/orders/:sessionToken
 * Public — get all orders for a session (so the diner can track status).
 */
router.get(
  "/:restaurantId/orders/:sessionToken",
  orderController.getDinerOrders.bind(orderController)
);

export default router;
