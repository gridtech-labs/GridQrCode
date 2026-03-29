import { Router, Request, Response, NextFunction } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requireTenant } from "../middleware/tenant.middleware";
import { requireRole } from "../middleware/role.middleware";
import { query } from "../db/pool";
import { QueryResultRow } from "pg";

const router = Router();

router.use(authenticate, requireTenant);

interface UserRow extends QueryResultRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: string;
  avatar_url: string | null;
  created_at: Date;
}

/**
 * GET /api/v1/staff
 * List all users belonging to the restaurant.
 */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await query<UserRow>(
      `SELECT id, first_name, last_name, email, role, avatar_url, created_at
       FROM users
       WHERE restaurant_id = $1 AND is_active = true
       ORDER BY created_at ASC`,
      [req.restaurantId!]
    );

    const users = rows.map((r) => ({
      id: r.id,
      firstName: r.first_name,
      lastName: r.last_name,
      email: r.email,
      role: r.role,
      avatarUrl: r.avatar_url,
      createdAt: r.created_at.toISOString(),
    }));

    res.json({ success: true, data: { users } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/staff/invite
 * Send an invitation email to a new staff member.
 * Full implementation (token generation + email) in Sprint 3.
 */
router.post(
  "/invite",
  requireRole("manager"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, role = "staff" } = req.body as { email?: string; role?: string };

      if (!email) {
        res.status(400).json({ success: false, error: "VALIDATION_ERROR", message: "Email is required" });
        return;
      }

      const VALID_ROLES = ["manager", "staff", "kitchen"];
      if (!VALID_ROLES.includes(role)) {
        res.status(400).json({ success: false, error: "VALIDATION_ERROR", message: "Invalid role" });
        return;
      }

      // Store the invitation record
      const token = require("crypto").randomBytes(32).toString("hex");
      await query(
        `INSERT INTO staff_invitations (restaurant_id, email, role, token, invited_by)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [req.restaurantId!, email, role, token, req.user!.id]
      );

      // TODO Sprint 3: send invitation email via SendGrid / Resend
      console.info(`[invite] ${email} invited as ${role} — token: ${token}`);

      res.status(201).json({
        success: true,
        data: {
          message: "Invitation created",
          note: "Email delivery will be wired in Sprint 3",
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
