import { Request, Response, NextFunction } from "express";
import { orderService } from "../services/order.service";

const ITEM_STATUSES = ["pending", "preparing", "ready", "served"] as const;

export class KitchenController {

  // GET /api/v1/kitchen/orders — active orders for the KDS
  async listOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orders = await orderService.listKitchenOrders(req.restaurantId!);
      res.json({ success: true, data: { orders } });
    } catch (err) { next(err); }
  }

  // GET /api/v1/kitchen/stats
  async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await orderService.getKitchenStats(req.restaurantId!);
      res.json({ success: true, data: { stats } });
    } catch (err) { next(err); }
  }

  // PATCH /api/v1/kitchen/orders/:orderId/items/:itemId
  async updateItemStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status } = req.body as { status?: string };
      if (!status || !ITEM_STATUSES.includes(status as typeof ITEM_STATUSES[number])) {
        res.status(400).json({
          success: false,
          error: "VALIDATION_ERROR",
          message: `Status must be one of: ${ITEM_STATUSES.join(", ")}`,
        });
        return;
      }
      const result = await orderService.updateItemStatus(
        req.params.orderId,
        req.params.itemId,
        req.restaurantId!,
        status as typeof ITEM_STATUSES[number]
      );
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  }

  // PATCH /api/v1/kitchen/orders/:orderId/bump — advance all items to next status
  async bumpOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const order = await orderService.getById(req.params.orderId, req.restaurantId!);
      if (!order) {
        res.status(404).json({ success: false, error: "NOT_FOUND", message: "Order not found" });
        return;
      }

      // Determine the next item status based on current order status
      const nextItemStatus: Record<string, typeof ITEM_STATUSES[number]> = {
        confirmed: "preparing",
        preparing: "ready",
        ready:     "served",
      };
      const target = nextItemStatus[order.status] ?? "preparing";

      // Bump all non-terminal items
      for (const item of order.items) {
        if (!["ready", "served"].includes(item.status)) {
          await orderService.updateItemStatus(
            order.id, item.id, req.restaurantId!, target
          );
        }
      }

      const updated = await orderService.getById(req.params.orderId, req.restaurantId!);
      res.json({ success: true, data: { order: updated } });
    } catch (err) { next(err); }
  }
}

export const kitchenController = new KitchenController();
