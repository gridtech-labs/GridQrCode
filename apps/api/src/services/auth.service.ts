import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { query, queryOne, withTransaction } from "../db/pool";
import type { AuthTokens, AuthUser, JwtPayload, UserRole } from "@qr-saas/shared";

// ── Config ────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET!;
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET ?? process.env.JWT_SECRET!;
const ACCESS_EXPIRES = process.env.JWT_EXPIRES_IN ?? "15m";
const REFRESH_EXPIRES = process.env.REFRESH_TOKEN_EXPIRES_IN ?? "30d";
const SALT_ROUNDS = 12;
const TRIAL_DAYS = 14;

// ── Row types (internal) ──────────────────────────────────────

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  first_name: string | null;
  last_name: string | null;
  role: UserRole;
  restaurant_id: string | null;
  avatar_url: string | null;
  is_active: boolean;
}

interface PlanRow {
  id: string;
}

// ── Token helpers ─────────────────────────────────────────────

function signAccessToken(user: UserRow): string {
  const payload: Omit<JwtPayload, "iat" | "exp"> = {
    sub: user.id,
    email: user.email,
    role: user.role,
    restaurantId: user.restaurant_id,
    type: "access",
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_EXPIRES } as jwt.SignOptions);
}

function signRefreshToken(userId: string): { token: string; hash: string; expiresAt: Date } {
  const token = crypto.randomBytes(40).toString("hex");
  const hash = crypto.createHash("sha256").update(token).digest("hex");

  // Parse refresh expiry to ms
  const days = parseInt(REFRESH_EXPIRES, 10) || 30;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  return { token, hash, expiresAt };
}

function mapUserRow(row: UserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    role: row.role,
    restaurantId: row.restaurant_id,
    avatarUrl: row.avatar_url,
  };
}

// ── Auth Service ──────────────────────────────────────────────

export class AuthService {
  /**
   * Register a new restaurant + owner user.
   * Provisions a 14-day Pro trial.
   */
  async register(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    restaurantName: string,
    restaurantSlug?: string
  ): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    // Check duplicate email
    const existing = await queryOne<{ id: string }>(
      "SELECT id FROM users WHERE email = $1",
      [email.toLowerCase().trim()]
    );
    if (existing) {
      throw Object.assign(new Error("Email already in use"), { statusCode: 409 });
    }

    // Derive slug if not provided
    const slug =
      restaurantSlug ??
      restaurantName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 80);

    // Check slug collision
    const slugExists = await queryOne<{ id: string }>(
      "SELECT id FROM restaurants WHERE slug = $1",
      [slug]
    );
    if (slugExists) {
      throw Object.assign(new Error(`Slug "${slug}" is already taken`), { statusCode: 409 });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    return withTransaction(async (client) => {
      // Get the Pro plan id for trial
      const plan = await client
        .query<PlanRow>("SELECT id FROM plans WHERE name = 'pro' LIMIT 1")
        .then((r) => r.rows[0]);

      if (!plan) {
        throw new Error("Default plan not found — run migrations first");
      }

      const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

      // Create restaurant
      const { rows: [restaurant] } = await client.query<{ id: string }>(
        `INSERT INTO restaurants
           (name, slug, plan_id, subscription_status, trial_ends_at, email)
         VALUES ($1, $2, $3, 'trial', $4, $5)
         RETURNING id`,
        [restaurantName, slug, plan.id, trialEndsAt, email.toLowerCase().trim()]
      );

      // Create owner user
      const { rows: [userRow] } = await client.query<UserRow>(
        `INSERT INTO users
           (email, password_hash, first_name, last_name, role, restaurant_id)
         VALUES ($1, $2, $3, $4, 'owner', $5)
         RETURNING id, email, password_hash, first_name, last_name,
                   role, restaurant_id, avatar_url, is_active`,
        [email.toLowerCase().trim(), passwordHash, firstName, lastName, restaurant.id]
      );

      const accessToken = signAccessToken(userRow);
      const { token: refreshToken, hash, expiresAt } = signRefreshToken(userRow.id);

      await client.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [userRow.id, hash, expiresAt]
      );

      return {
        user: mapUserRow(userRow),
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: 15 * 60, // seconds
        },
      };
    });
  }

  /**
   * Validate credentials and issue tokens.
   */
  async login(
    email: string,
    password: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    const userRow = await queryOne<UserRow>(
      `SELECT id, email, password_hash, first_name, last_name,
              role, restaurant_id, avatar_url, is_active
       FROM users WHERE email = $1`,
      [email.toLowerCase().trim()]
    );

    if (!userRow) {
      throw Object.assign(new Error("Invalid credentials"), { statusCode: 401 });
    }

    if (!userRow.is_active) {
      throw Object.assign(new Error("Account is deactivated"), { statusCode: 403 });
    }

    const valid = await bcrypt.compare(password, userRow.password_hash);
    if (!valid) {
      throw Object.assign(new Error("Invalid credentials"), { statusCode: 401 });
    }

    // Update last login
    await query("UPDATE users SET last_login_at = now() WHERE id = $1", [userRow.id]);

    const accessToken = signAccessToken(userRow);
    const { token: refreshToken, hash, expiresAt } = signRefreshToken(userRow.id);

    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [userRow.id, hash, expiresAt, ipAddress ?? null, userAgent ?? null]
    );

    return {
      user: mapUserRow(userRow),
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 15 * 60,
      },
    };
  }

  /**
   * Rotate a refresh token → issue new access + refresh pair.
   */
  async refreshTokens(rawRefreshToken: string): Promise<AuthTokens> {
    const hash = crypto.createHash("sha256").update(rawRefreshToken).digest("hex");

    const tokenRow = await queryOne<{
      id: string;
      user_id: string;
      expires_at: Date;
      revoked_at: Date | null;
    }>(
      `SELECT id, user_id, expires_at, revoked_at
       FROM refresh_tokens WHERE token_hash = $1`,
      [hash]
    );

    if (!tokenRow) {
      throw Object.assign(new Error("Invalid refresh token"), { statusCode: 401 });
    }
    if (tokenRow.revoked_at) {
      throw Object.assign(new Error("Refresh token revoked"), { statusCode: 401 });
    }
    if (tokenRow.expires_at < new Date()) {
      throw Object.assign(new Error("Refresh token expired"), { statusCode: 401 });
    }

    const userRow = await queryOne<UserRow>(
      `SELECT id, email, password_hash, first_name, last_name,
              role, restaurant_id, avatar_url, is_active
       FROM users WHERE id = $1`,
      [tokenRow.user_id]
    );

    if (!userRow || !userRow.is_active) {
      throw Object.assign(new Error("User not found or deactivated"), { statusCode: 401 });
    }

    // Revoke old token
    await query(
      "UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1",
      [tokenRow.id]
    );

    // Issue fresh tokens
    const accessToken = signAccessToken(userRow);
    const { token: newRefreshToken, hash: newHash, expiresAt } = signRefreshToken(userRow.id);

    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userRow.id, newHash, expiresAt]
    );

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: 15 * 60,
    };
  }

  /**
   * Revoke a refresh token (logout).
   */
  async logout(rawRefreshToken: string): Promise<void> {
    const hash = crypto.createHash("sha256").update(rawRefreshToken).digest("hex");
    await query(
      "UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL",
      [hash]
    );
  }

  /**
   * Get current user by ID.
   */
  async getMe(userId: string): Promise<AuthUser | null> {
    const row = await queryOne<UserRow>(
      `SELECT id, email, password_hash, first_name, last_name,
              role, restaurant_id, avatar_url, is_active
       FROM users WHERE id = $1 AND is_active = true`,
      [userId]
    );
    return row ? mapUserRow(row) : null;
  }

  /**
   * Verify an access token and return its payload.
   */
  verifyAccessToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, JWT_SECRET) as JwtPayload;
    } catch {
      throw Object.assign(new Error("Invalid or expired token"), { statusCode: 401 });
    }
  }
}

export const authService = new AuthService();
