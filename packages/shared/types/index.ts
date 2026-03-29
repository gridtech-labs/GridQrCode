// ============================================================
// Shared Types — used by both api and web packages
// ============================================================

// ── Auth ──────────────────────────────────────────────────────

export type UserRole = "super_admin" | "owner" | "manager" | "staff" | "kitchen";

export interface JwtPayload {
  sub: string;         // user id
  email: string;
  role: UserRole;
  restaurantId: string | null;
  type: "access" | "refresh" | "diner";
  iat?: number;
  exp?: number;
}

export interface DinerJwtPayload {
  sub: string;         // session id
  tableId: string;
  restaurantId: string;
  type: "diner";
  iat?: number;
  exp?: number;
}

// ── API Responses ─────────────────────────────────────────────

export interface ApiSuccess<T = unknown> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiError {
  success: false;
  error: string;
  message: string;
  statusCode: number;
  details?: Record<string, string[]>;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ── Auth DTOs ─────────────────────────────────────────────────

export interface RegisterDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  restaurantName: string;
  restaurantSlug?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
  restaurantId: string | null;
  avatarUrl: string | null;
}

// ── Restaurant ───────────────────────────────────────────────

export type SubscriptionStatus = "trial" | "active" | "past_due" | "cancelled";

export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  coverUrl: string | null;
  description: string | null;
  currency: string;
  timezone: string;
  taxRate: number;
  serviceCharge: number;
  settings: Record<string, unknown>;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: string | null;
  isActive: boolean;
  createdAt: string;
}

// ── Orders ────────────────────────────────────────────────────

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "served"
  | "cancelled";

export type OrderType = "dine_in" | "takeaway" | "delivery";

// ── Socket Events ─────────────────────────────────────────────

export const SOCKET_EVENTS = {
  // Client → Server
  JOIN_RESTAURANT: "join:restaurant",
  JOIN_KITCHEN: "join:kitchen",
  JOIN_SESSION: "join:session",
  KITCHEN_ITEM_UPDATE: "kitchen:item:update",

  // Server → Client
  ORDER_NEW: "order:new",
  ORDER_UPDATED: "order:updated",
  ORDER_ITEM_UPDATED: "order:item:updated",
  TABLE_STATUS_CHANGED: "table:status:changed",
  STAFF_CALL: "staff:call",
  NOTIFICATION: "notification",
} as const;

export type SocketEventKey = keyof typeof SOCKET_EVENTS;
export type SocketEventValue = (typeof SOCKET_EVENTS)[SocketEventKey];
