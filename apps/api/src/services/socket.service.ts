import { Server as SocketIOServer, Socket } from "socket.io";
import type { Server as HTTPServer } from "http";
import type { Order } from "@qr-saas/shared";
import { SOCKET_EVENTS } from "@qr-saas/shared";

let io: SocketIOServer | null = null;

export function initSocketIO(httpServer: HTTPServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: (process.env.APP_URL ?? "http://localhost:3000").split(","),
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket: Socket) => {
    // ── Staff: join restaurant room ────────────────────────────
    socket.on(SOCKET_EVENTS.JOIN_RESTAURANT, (restaurantId: string) => {
      socket.join(`restaurant:${restaurantId}`);
    });

    // ── Kitchen: join kitchen room ─────────────────────────────
    socket.on(SOCKET_EVENTS.JOIN_KITCHEN, (restaurantId: string) => {
      socket.join(`kitchen:${restaurantId}`);
    });

    // ── Diner: join session room ────────────────────────────────
    socket.on(SOCKET_EVENTS.JOIN_SESSION, (sessionId: string) => {
      socket.join(`session:${sessionId}`);
    });
  });

  console.log("📡 Socket.IO ready");
  return io;
}

export function getIO(): SocketIOServer {
  if (!io) throw new Error("Socket.IO not initialised — call initSocketIO first");
  return io;
}

// ── Emit helpers ──────────────────────────────────────────────

export function emitNewOrder(order: Order): void {
  if (!io) return;
  // Notify staff dashboard
  io.to(`restaurant:${order.restaurantId}`).emit(SOCKET_EVENTS.ORDER_NEW, order);
  // Notify kitchen
  io.to(`kitchen:${order.restaurantId}`).emit(SOCKET_EVENTS.ORDER_NEW, order);
}

export function emitOrderUpdated(order: Order): void {
  if (!io) return;
  // Staff and kitchen
  io.to(`restaurant:${order.restaurantId}`).emit(SOCKET_EVENTS.ORDER_UPDATED, order);
  io.to(`kitchen:${order.restaurantId}`).emit(SOCKET_EVENTS.ORDER_UPDATED, order);
  // Diner session — so the customer's status page updates
  if (order.sessionId) {
    io.to(`session:${order.sessionId}`).emit(SOCKET_EVENTS.ORDER_UPDATED, order);
  }
}

export function emitTableStatusChanged(
  restaurantId: string,
  tableId: string,
  status: string
): void {
  if (!io) return;
  io.to(`restaurant:${restaurantId}`).emit(SOCKET_EVENTS.TABLE_STATUS_CHANGED, {
    tableId,
    status,
  });
}

export function emitOrderItemUpdated(
  restaurantId: string,
  orderId: string,
  itemId: string,
  status: string
): void {
  if (!io) return;
  const payload = { orderId, itemId, status };
  io.to(`restaurant:${restaurantId}`).emit(SOCKET_EVENTS.ORDER_ITEM_UPDATED, payload);
  io.to(`kitchen:${restaurantId}`).emit(SOCKET_EVENTS.ORDER_ITEM_UPDATED, payload);
}
