import { Router } from "express";
import { menuController } from "../controllers/menu.controller";
import { authenticate } from "../middleware/auth.middleware";
import { requireTenant } from "../middleware/tenant.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

// All menu management routes require auth + tenant scope
router.use(authenticate, requireTenant);

// ── Categories ────────────────────────────────────────────────

router.get("/categories",                    menuController.listCategories.bind(menuController));
router.post("/categories",     requireRole("manager"), menuController.createCategory.bind(menuController));
router.patch("/categories/:id",requireRole("manager"), menuController.updateCategory.bind(menuController));
router.delete("/categories/:id",requireRole("manager"),menuController.deleteCategory.bind(menuController));
router.post("/categories/:id/image", requireRole("manager"), menuController.uploadCategoryImage.bind(menuController));

// ── Items ─────────────────────────────────────────────────────

router.get("/items",                         menuController.listItems.bind(menuController));
router.get("/items/:id",                     menuController.getItem.bind(menuController));
router.post("/items",          requireRole("manager"), menuController.createItem.bind(menuController));
router.patch("/items/:id",     requireRole("manager"), menuController.updateItem.bind(menuController));
router.delete("/items/:id",    requireRole("manager"), menuController.deleteItem.bind(menuController));
router.post("/items/:id/toggle", requireRole("staff"), menuController.toggleAvailability.bind(menuController));
router.post("/items/:id/image",  requireRole("manager"), menuController.uploadItemImage.bind(menuController));

// ── Modifiers ─────────────────────────────────────────────────

router.get("/modifiers",                         menuController.listModifiers.bind(menuController));
router.post("/modifiers",        requireRole("manager"), menuController.createModifier.bind(menuController));
router.delete("/modifiers/:id",  requireRole("manager"), menuController.deleteModifier.bind(menuController));

export default router;
