import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authController } from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

// ── Rate Limiters ─────────────────────────────────────────────

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: {
    success: false,
    error: "RATE_LIMIT_EXCEEDED",
    message: "Too many auth attempts, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const refreshLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20,
  message: {
    success: false,
    error: "RATE_LIMIT_EXCEEDED",
    message: "Too many refresh attempts",
  },
});

// ── Routes ────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/register
 * Register a new restaurant + owner account.
 * Body: { email, password, firstName, lastName, restaurantName, restaurantSlug? }
 */
router.post("/register", authLimiter, authController.register.bind(authController));

/**
 * POST /api/v1/auth/login
 * Body: { email, password }
 * Returns: { accessToken, expiresIn, user }
 * Sets: refreshToken httpOnly cookie
 */
router.post("/login", authLimiter, authController.login.bind(authController));

/**
 * POST /api/v1/auth/refresh
 * Reads refreshToken from httpOnly cookie or body.
 * Returns: { accessToken, expiresIn }
 * Rotates refresh token.
 */
router.post("/refresh", refreshLimiter, authController.refresh.bind(authController));

/**
 * POST /api/v1/auth/logout
 * Revokes refresh token.
 */
router.post("/logout", authController.logout.bind(authController));

/**
 * GET /api/v1/auth/me
 * Returns the authenticated user.
 */
router.get("/me", authenticate, authController.me.bind(authController));

export default router;
