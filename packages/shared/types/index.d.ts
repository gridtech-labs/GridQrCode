export type UserRole = "super_admin" | "owner" | "manager" | "staff" | "kitchen";
export interface JwtPayload {
    sub: string;
    email: string;
    role: UserRole;
    restaurantId: string | null;
    type: "access" | "refresh" | "diner";
    iat?: number;
    exp?: number;
}
export interface DinerJwtPayload {
    sub: string;
    tableId: string;
    restaurantId: string;
    type: "diner";
    iat?: number;
    exp?: number;
}
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
export type OrderStatus = "pending" | "confirmed" | "preparing" | "ready" | "served" | "cancelled";
export type OrderType = "dine_in" | "takeaway" | "delivery";
export declare const SOCKET_EVENTS: {
    readonly JOIN_RESTAURANT: "join:restaurant";
    readonly JOIN_KITCHEN: "join:kitchen";
    readonly JOIN_SESSION: "join:session";
    readonly KITCHEN_ITEM_UPDATE: "kitchen:item:update";
    readonly ORDER_NEW: "order:new";
    readonly ORDER_UPDATED: "order:updated";
    readonly ORDER_ITEM_UPDATED: "order:item:updated";
    readonly TABLE_STATUS_CHANGED: "table:status:changed";
    readonly STAFF_CALL: "staff:call";
    readonly NOTIFICATION: "notification";
};
export type SocketEventKey = keyof typeof SOCKET_EVENTS;
export type SocketEventValue = (typeof SOCKET_EVENTS)[SocketEventKey];
//# sourceMappingURL=index.d.ts.map