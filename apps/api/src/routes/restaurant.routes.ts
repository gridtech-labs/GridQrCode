import { Router } from "express";
import { restaurantController } from "../controllers/restaurant.controller";
import { authenticate } from "../middleware/auth.middleware";
import { requireTenant } from "../middleware/tenant.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

// All restaurant routes require auth + tenant
router.use(authenticate, requireTenant);

/**
 * GET /api/v1/restaurant
 * Get the authenticated user's restaurant profile.
 */
router.get("/", restaurantController.getMyRestaurant.bind(restaurantController));

/**
 * PATCH /api/v1/restaurant
 * Update restaurant profile (name, description, settings, etc.)
 * Requires: manager or above
 */
router.patch(
  "/",
  requireRole("manager"),
  restaurantController.updateMyRestaurant.bind(restaurantController)
);

/**
 * POST /api/v1/restaurant/logo
 * Upload logo image (multipart/form-data, field: "file")
 */
router.post(
  "/logo",
  requireRole("manager"),
  restaurantController.uploadLogo.bind(restaurantController)
);

/**
 * POST /api/v1/restaurant/cover
 * Upload cover image
 */
router.post(
  "/cover",
  requireRole("manager"),
  restaurantController.uploadCover.bind(restaurantController)
);

export default router;
