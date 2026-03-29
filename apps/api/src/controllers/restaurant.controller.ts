import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { restaurantService } from "../services/restaurant.service";
import { uploadSingle } from "../middleware/upload.middleware";

// ── Validation ────────────────────────────────────────────────

const updateSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  description: z.string().max(2000).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  currency: z.string().length(3).optional(),
  timezone: z.string().max(50).optional(),
  taxRate: z.number().min(0).max(1).optional(),
  serviceCharge: z.number().min(0).max(1).optional(),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    postalCode: z.string().optional(),
  }).optional(),
  settings: z.record(z.unknown()).optional(),
});

// ── Controller ────────────────────────────────────────────────

export class RestaurantController {
  async getMyRestaurant(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurant = await restaurantService.getById(req.restaurantId!);
      if (!restaurant) {
        res.status(404).json({ success: false, error: "NOT_FOUND", message: "Restaurant not found" });
        return;
      }
      res.json({ success: true, data: { restaurant } });
    } catch (err) { next(err); }
  }

  async updateMyRestaurant(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: "VALIDATION_ERROR",
          message: "Invalid data",
          details: parsed.error.flatten().fieldErrors,
        });
        return;
      }
      const restaurant = await restaurantService.update(req.restaurantId!, parsed.data);
      res.json({ success: true, data: { restaurant } });
    } catch (err) { next(err); }
  }

  uploadLogo(req: Request, res: Response, next: NextFunction): void {
    uploadSingle(req, res, async (err) => {
      if (err) return next(err);
      if (!req.file) {
        res.status(400).json({ success: false, error: "NO_FILE", message: "No file uploaded" });
        return;
      }
      try {
        const url = await restaurantService.uploadLogo(req.restaurantId!, req.file.buffer);
        res.json({ success: true, data: { url } });
      } catch (e) { next(e); }
    });
  }

  uploadCover(req: Request, res: Response, next: NextFunction): void {
    uploadSingle(req, res, async (err) => {
      if (err) return next(err);
      if (!req.file) {
        res.status(400).json({ success: false, error: "NO_FILE", message: "No file uploaded" });
        return;
      }
      try {
        const url = await restaurantService.uploadCover(req.restaurantId!, req.file.buffer);
        res.json({ success: true, data: { url } });
      } catch (e) { next(e); }
    });
  }

  // Super admin
  async listAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await restaurantService.listAll(page, limit);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  }
}

export const restaurantController = new RestaurantController();
