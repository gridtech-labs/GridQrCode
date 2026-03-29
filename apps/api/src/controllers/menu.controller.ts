import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { menuService } from "../services/menu.service";
import { uploadSingle } from "../middleware/upload.middleware";

// ── Schemas ───────────────────────────────────────────────────

const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  sortOrder: z.number().int().min(0).optional(),
  availableFrom: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  availableUntil: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

const createItemSchema = z.object({
  categoryId: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  price: z.number().positive(),
  tags: z.array(z.string()).optional(),
  allergens: z.array(z.string()).optional(),
  calories: z.number().int().positive().optional(),
  prepTimeMin: z.number().int().min(0).max(300).optional(),
  isFeatured: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  modifierIds: z.array(z.string().uuid()).optional(),
});

const createModifierSchema = z.object({
  name: z.string().min(1).max(100),
  isRequired: z.boolean().optional(),
  minSelect: z.number().int().min(0).optional(),
  maxSelect: z.number().int().min(1).optional(),
  options: z.array(z.object({
    name: z.string().min(1).max(100),
    priceDelta: z.number().optional(),
  })).min(1),
});

// ── Controller ────────────────────────────────────────────────

export class MenuController {

  // ── Categories ───────────────────────────────────────────────

  async listCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const categories = await menuService.listCategories(req.restaurantId!);
      res.json({ success: true, data: { categories } });
    } catch (err) { next(err); }
  }

  async createCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = createCategorySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: "VALIDATION_ERROR", message: "Invalid data", details: parsed.error.flatten().fieldErrors });
        return;
      }
      const category = await menuService.createCategory(req.restaurantId!, parsed.data);
      res.status(201).json({ success: true, data: { category } });
    } catch (err) { next(err); }
  }

  async updateCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = createCategorySchema.partial().extend({ isActive: z.boolean().optional() }).safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: "VALIDATION_ERROR", message: "Invalid data", details: parsed.error.flatten().fieldErrors });
        return;
      }
      const category = await menuService.updateCategory(req.params.id, req.restaurantId!, parsed.data);
      res.json({ success: true, data: { category } });
    } catch (err) { next(err); }
  }

  async deleteCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await menuService.deleteCategory(req.params.id, req.restaurantId!);
      res.json({ success: true, data: { message: "Category deleted" } });
    } catch (err) { next(err); }
  }

  uploadCategoryImage(req: Request, res: Response, next: NextFunction): void {
    uploadSingle(req, res, async (err) => {
      if (err) return next(err);
      if (!req.file) { res.status(400).json({ success: false, error: "NO_FILE", message: "No file uploaded" }); return; }
      try {
        const url = await menuService.uploadCategoryImage(req.params.id, req.restaurantId!, req.file.buffer);
        res.json({ success: true, data: { url } });
      } catch (e) { next(e); }
    });
  }

  // ── Items ─────────────────────────────────────────────────────

  async listItems(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const items = await menuService.listItems(req.restaurantId!, {
        categoryId: req.query.categoryId as string | undefined,
        search: req.query.search as string | undefined,
        featuredOnly: req.query.featured === "true",
      });
      res.json({ success: true, data: { items } });
    } catch (err) { next(err); }
  }

  async getItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const item = await menuService.getItemById(req.params.id, req.restaurantId!);
      if (!item) { res.status(404).json({ success: false, error: "NOT_FOUND", message: "Item not found" }); return; }
      res.json({ success: true, data: { item } });
    } catch (err) { next(err); }
  }

  async createItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = createItemSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: "VALIDATION_ERROR", message: "Invalid data", details: parsed.error.flatten().fieldErrors });
        return;
      }
      const item = await menuService.createItem(req.restaurantId!, parsed.data);
      res.status(201).json({ success: true, data: { item } });
    } catch (err) { next(err); }
  }

  async updateItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = createItemSchema.partial().extend({ isAvailable: z.boolean().optional() }).safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: "VALIDATION_ERROR", message: "Invalid data", details: parsed.error.flatten().fieldErrors });
        return;
      }
      const item = await menuService.updateItem(req.params.id, req.restaurantId!, parsed.data);
      res.json({ success: true, data: { item } });
    } catch (err) { next(err); }
  }

  async deleteItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await menuService.deleteItem(req.params.id, req.restaurantId!);
      res.json({ success: true, data: { message: "Item deleted" } });
    } catch (err) { next(err); }
  }

  async toggleAvailability(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const item = await menuService.toggleAvailability(req.params.id, req.restaurantId!);
      res.json({ success: true, data: { item } });
    } catch (err) { next(err); }
  }

  uploadItemImage(req: Request, res: Response, next: NextFunction): void {
    uploadSingle(req, res, async (err) => {
      if (err) return next(err);
      if (!req.file) { res.status(400).json({ success: false, error: "NO_FILE", message: "No file uploaded" }); return; }
      try {
        const url = await menuService.uploadItemImage(req.params.id, req.restaurantId!, req.file.buffer);
        res.json({ success: true, data: { url } });
      } catch (e) { next(e); }
    });
  }

  // ── Modifiers ─────────────────────────────────────────────────

  async listModifiers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const modifiers = await menuService.listModifiers(req.restaurantId!);
      res.json({ success: true, data: { modifiers } });
    } catch (err) { next(err); }
  }

  async createModifier(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = createModifierSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: "VALIDATION_ERROR", message: "Invalid data", details: parsed.error.flatten().fieldErrors });
        return;
      }
      const modifier = await menuService.createModifier(req.restaurantId!, parsed.data);
      res.status(201).json({ success: true, data: { modifier } });
    } catch (err) { next(err); }
  }

  async deleteModifier(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await menuService.deleteModifier(req.params.id, req.restaurantId!);
      res.json({ success: true, data: { message: "Modifier deleted" } });
    } catch (err) { next(err); }
  }
}

export const menuController = new MenuController();
