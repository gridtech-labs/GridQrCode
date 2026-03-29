import { Request, Response, NextFunction } from "express";
import type { UserRole } from "@qr-saas/shared";

// Role hierarchy — higher index = more permissions
const ROLE_HIERARCHY: UserRole[] = [
  "kitchen",
  "staff",
  "manager",
  "owner",
  "super_admin",
];

function getRoleLevel(role: UserRole): number {
  return ROLE_HIERARCHY.indexOf(role);
}

/**
 * Require the authenticated user to have at least the given role.
 *
 * Usage:
 *   router.post('/items', authenticate, requireTenant, requireRole('manager'), handler)
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "UNAUTHORIZED",
        message: "Authentication required",
      });
      return;
    }

    const userLevel = getRoleLevel(req.user.role);
    const hasPermission = allowedRoles.some(
      (r) => getRoleLevel(r) <= userLevel
    );

    if (!hasPermission) {
      res.status(403).json({
        success: false,
        error: "FORBIDDEN",
        message: `This action requires one of the following roles: ${allowedRoles.join(", ")}`,
      });
      return;
    }

    next();
  };
}

/**
 * Shorthand role guards
 */
export const requireOwner = requireRole("owner");
export const requireManager = requireRole("manager");
export const requireStaff = requireRole("staff");
export const requireKitchen = requireRole("kitchen");
export const requireSuperAdmin = requireRole("super_admin");
