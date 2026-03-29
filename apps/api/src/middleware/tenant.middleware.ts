import { Request, Response, NextFunction } from "express";
import { queryOne } from "../db/pool";

interface RestaurantRow {
  id: string;
  subscription_status: string;
  trial_ends_at: Date | null;
  is_active: boolean;
}

/**
 * Attaches `req.restaurantId` from the authenticated user's JWT.
 * Must come AFTER `authenticate` middleware.
 *
 * Super admins can optionally impersonate a restaurant by passing
 * the `X-Restaurant-Id` header.
 */
export async function requireTenant(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: "UNAUTHORIZED",
      message: "Authentication required",
    });
    return;
  }

  // Super admin impersonation
  if (req.user.role === "super_admin") {
    const impersonateId = req.headers["x-restaurant-id"] as string | undefined;
    if (impersonateId) {
      req.restaurantId = impersonateId;
    }
    // Super admin without impersonation — no restaurant scope needed
    next();
    return;
  }

  const restaurantId = req.user.restaurantId;

  if (!restaurantId) {
    res.status(403).json({
      success: false,
      error: "NO_RESTAURANT",
      message: "User is not associated with a restaurant",
    });
    return;
  }

  // Verify restaurant still active
  const restaurant = await queryOne<RestaurantRow>(
    "SELECT id, subscription_status, trial_ends_at, is_active FROM restaurants WHERE id = $1",
    [restaurantId]
  );

  if (!restaurant || !restaurant.is_active) {
    res.status(403).json({
      success: false,
      error: "RESTAURANT_INACTIVE",
      message: "Restaurant account is inactive",
    });
    return;
  }

  // Check subscription status
  if (
    restaurant.subscription_status === "trial" &&
    restaurant.trial_ends_at &&
    new Date(restaurant.trial_ends_at) < new Date()
  ) {
    res.status(402).json({
      success: false,
      error: "TRIAL_EXPIRED",
      message: "Your free trial has expired. Please upgrade your plan.",
      upgradeUrl: "/settings/billing",
    });
    return;
  }

  if (restaurant.subscription_status === "cancelled") {
    res.status(402).json({
      success: false,
      error: "SUBSCRIPTION_CANCELLED",
      message: "Subscription has been cancelled. Please reactivate to continue.",
      upgradeUrl: "/settings/billing",
    });
    return;
  }

  req.restaurantId = restaurantId;
  next();
}
