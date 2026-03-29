import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { orderService } from "../services/order.service";
import type { OrderStatus } from "@qr-saas/shared";

const ORDER_STATUSES: OrderStatus[] = ["pending", "confirmed", "preparing", "ready", "served", "cancelled"];

const placeOrderSchema = z.object({
  sessionToken: z.string().min(1),
  items: z.array(z.object({
    menuItemId: z.string().uuid(),
    quantity: z.number().int().min(1).max(99),
    modifications: z.array(z.object({
      modifierId:   z.string(),
      modifierName: z.string(),
      optionId:     z.string(),
      optionName:   z.string(),
      priceDelta:   z.number().default(0),
    })).optional(),
    notes: z.string().max(500).optional(),
  })).min(1),
  notes: z.string().max(1000).optional(),
  type: z.enum(["dine_in", "takeaway", "delivery"]).optional(),
});

export class OrderController {

  // POST /api/v1/orders — place a new order (diner, no staff auth)
  async placeOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // restaurantId comes from the URL param for diner routes
      const restaurantId = req.params.restaurantId ?? req.restaurantId!;
      const parsed = placeOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: "VALIDATION_ERROR", message: "Invalid order data", details: parsed.error.flatten().fieldErrors });
        return;
      }
      const order = await orderService.placeOrder(restaurantId, parsed.data);
      res.status(201).json({ success: true, data: { order } });
    } catch (err) { next(err); }
  }

  // GET /api/v1/orders — list for restaurant (staff)
  async listOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = req.query.status as string | undefined;
      const page   = parseInt(req.query.page as string)  || 1;
      const limit  = parseInt(req.query.limit as string) || 50;
      const result = await orderService.listForRestaurant(req.restaurantId!, {
        status,
        limit,
        offset: (page - 1) * limit,
      });
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  }

  // GET /api/v1/orders/stats
  async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await orderService.getTodayStats(req.restaurantId!);
      res.json({ success: true, data: { stats } });
    } catch (err) { next(err); }
  }

  // GET /api/v1/orders/:id
  async getOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const order = await orderService.getById(req.params.id, req.restaurantId!);
      if (!order) { res.status(404).json({ success: false, error: "NOT_FOUND", message: "Order not found" }); return; }
      res.json({ success: true, data: { order } });
    } catch (err) { next(err); }
  }

  // PATCH /api/v1/orders/:id/status
  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status } = req.body as { status?: string };
      if (!status || !ORDER_STATUSES.includes(status as OrderStatus)) {
        res.status(400).json({ success: false, error: "VALIDATION_ERROR", message: `Status must be one of: ${ORDER_STATUSES.join(", ")}` });
        return;
      }
      const order = await orderService.updateStatus(req.params.id, req.restaurantId!, status as OrderStatus);
      res.json({ success: true, data: { order } });
    } catch (err) { next(err); }
  }

  // GET /api/v1/diner/orders/:sessionToken — diner checks their own orders
  async getDinerOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.params.restaurantId;
      const orders = await orderService.getBySession(req.params.sessionToken, restaurantId);
      res.json({ success: true, data: { orders } });
    } catch (err) { next(err); }
  }
}

export const orderController = new OrderController();
