import { Request } from "express";
import { UserRole } from "@qr-saas/shared";

// ── Augment Express Request ───────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      restaurantId?: string;
    }
  }
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  restaurantId: string | null;
}

export interface AuthRequest extends Request {
  user: AuthenticatedUser;
  restaurantId: string;
}

export type AsyncHandler = (
  req: Request,
  res: import("express").Response,
  next: import("express").NextFunction
) => Promise<void>;
