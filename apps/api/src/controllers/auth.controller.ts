import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { authService } from "../services/auth.service";

// ── Validation Schemas ────────────────────────────────────────

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[0-9]/, "Password must contain a number"),
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  restaurantName: z.string().min(2, "Restaurant name is required").max(200),
  restaurantSlug: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens")
    .min(2)
    .max(100)
    .optional(),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

// ── Helper ────────────────────────────────────────────────────

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in ms
  path: "/api/v1/auth",
};

function getRefreshToken(req: Request): string | null {
  // Try httpOnly cookie first (preferred), then body
  return req.cookies?.refreshToken ?? req.body?.refreshToken ?? null;
}

// ── Controller ────────────────────────────────────────────────

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: "VALIDATION_ERROR",
          message: "Invalid request body",
          details: parsed.error.flatten().fieldErrors,
        });
        return;
      }

      const { email, password, firstName, lastName, restaurantName, restaurantSlug } =
        parsed.data;

      const result = await authService.register(
        email,
        password,
        firstName,
        lastName,
        restaurantName,
        restaurantSlug
      );

      // Set refresh token in httpOnly cookie
      res.cookie("refreshToken", result.tokens.refreshToken, REFRESH_COOKIE_OPTIONS);

      res.status(201).json({
        success: true,
        data: {
          user: result.user,
          accessToken: result.tokens.accessToken,
          expiresIn: result.tokens.expiresIn,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: "VALIDATION_ERROR",
          message: "Invalid request body",
          details: parsed.error.flatten().fieldErrors,
        });
        return;
      }

      const { email, password } = parsed.data;

      const result = await authService.login(
        email,
        password,
        req.ip,
        req.headers["user-agent"]
      );

      res.cookie("refreshToken", result.tokens.refreshToken, REFRESH_COOKIE_OPTIONS);

      res.json({
        success: true,
        data: {
          user: result.user,
          accessToken: result.tokens.accessToken,
          expiresIn: result.tokens.expiresIn,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawToken = getRefreshToken(req);

      if (!rawToken) {
        res.status(401).json({
          success: false,
          error: "MISSING_REFRESH_TOKEN",
          message: "Refresh token is required",
        });
        return;
      }

      const tokens = await authService.refreshTokens(rawToken);

      res.cookie("refreshToken", tokens.refreshToken, REFRESH_COOKIE_OPTIONS);

      res.json({
        success: true,
        data: {
          accessToken: tokens.accessToken,
          expiresIn: tokens.expiresIn,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawToken = getRefreshToken(req);

      if (rawToken) {
        await authService.logout(rawToken);
      }

      res.clearCookie("refreshToken", { path: "/api/v1/auth" });

      res.json({
        success: true,
        data: { message: "Logged out successfully" },
      });
    } catch (err) {
      next(err);
    }
  }

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: "UNAUTHORIZED", message: "Not authenticated" });
        return;
      }

      const user = await authService.getMe(req.user.id);
      if (!user) {
        res.status(404).json({ success: false, error: "NOT_FOUND", message: "User not found" });
        return;
      }

      res.json({ success: true, data: { user } });
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();
