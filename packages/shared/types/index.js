"use strict";
// ============================================================
// Shared Types — used by both api and web packages
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.SOCKET_EVENTS = void 0;
// ── Socket Events ─────────────────────────────────────────────
exports.SOCKET_EVENTS = {
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
};
//# sourceMappingURL=index.js.map