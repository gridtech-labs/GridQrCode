import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { billingService } from "../services/billing.service";

const changePlanSchema = z.object({
  planId: z.string().uuid(),
  billingCycle: z.enum(["monthly", "yearly"]).optional(),
});

export class BillingController {

  async listPlans(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plans = await billingService.listPlans();
      res.json({ success: true, data: { plans } });
    } catch (err) { next(err); }
  }

  async getSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const subscription = await billingService.getSubscription(req.restaurantId!);
      res.json({ success: true, data: { subscription } });
    } catch (err) { next(err); }
  }

  async getUsage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const usage = await billingService.getUsageStats(req.restaurantId!);
      res.json({ success: true, data: { usage } });
    } catch (err) { next(err); }
  }

  async getBillingHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const history = await billingService.getBillingHistory(req.restaurantId!);
      res.json({ success: true, data: { history } });
    } catch (err) { next(err); }
  }

  async changePlan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = changePlanSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: "VALIDATION_ERROR",
          message: "Invalid plan data",
          details: parsed.error.flatten().fieldErrors,
        });
        return;
      }
      const subscription = await billingService.changePlan(
        req.restaurantId!,
        parsed.data.planId,
        parsed.data.billingCycle ?? "monthly"
      );
      res.json({ success: true, data: { subscription } });
    } catch (err) { next(err); }
  }
}

export const billingController = new BillingController();
