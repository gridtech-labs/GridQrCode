import { Request, Response, NextFunction } from "express";
import { authService } from "../services/auth.service";
import type { UserRole } from "@qr-saas/shared";

// ── JWT Auth Middleware ────────────────────────────────────────

/**
 * Extracts and verifies the Bearer JWT from the Authorization header.
 * Attaches `req.user` on success.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      error: "UNAUTHORIZED",
      message: "Missing or malformed Authorization header",
    });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = authService.verifyAccessToken(token);

    if (payload.type !== "access") {
      res.status(401).json({
        success: false,
        error: "INVALID_TOKEN_TYPE",
        message: "Expected an access token",
      });
      return;
    }

    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      restaurantId: payload.restaurantId,
    };

    next();
  } catch {
    res.status(401).json({
      success: false,
      error: "INVALID_TOKEN",
      message: "Token is invalid or expired",
    });
  }
}

// ── Optional Auth Middleware ──────────────────────────────────

/**
 * Like `authenticate` but doesn't fail if no token provided.
 * Useful for endpoints that have both public and authenticated variants.
 */
export function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith("Bearer ")) {
    try {
      const payload = authService.verifyAccessToken(authHeader.slice(7));
      req.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        restaurantId: payload.restaurantId,
      };
    } catch {
      // Silently ignore invalid tokens
    }
  }

  next();
}
