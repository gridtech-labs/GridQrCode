import { query, queryOne, withTransaction } from "../db/pool";
import { emitNewOrder, emitOrderUpdated, emitTableStatusChanged } from "./socket.service";
import type { Order, OrderItem, OrderStatus, PlaceOrderDto } from "@qr-saas/shared";
import { QueryResultRow } from "pg";

// ── Row types ─────────────────────────────────────────────────

interface OrderRow extends QueryResultRow {
  id: string;
  restaurant_id: string;
  session_id: string | null;
  table_id: string | null;
  table_number: string | null;
  order_number: string;
  status: string;
  type: string;
  subtotal: string;
  tax_amount: string;
  service_charge: string;
  discount_amount: string;
  total_amount: string;
  notes: string | null;
  placed_at: Date;
  confirmed_at: Date | null;
  ready_at: Date | null;
  served_at: Date | null;
  cancelled_at: Date | null;
}

interface OrderItemRow extends QueryResultRow {
  id: string;
  order_id: string;
  item_id: string | null;
  item_name: string;
  item_price: string;
  quantity: number;
  unit_price: string;
  total_price: string;
  modifications: unknown;
  notes: string | null;
  status: string;
}

// ── Mappers ───────────────────────────────────────────────────

function mapOrderItem(row: OrderItemRow): OrderItem {
  return {
    id: row.id,
    orderId: row.order_id,
    itemId: row.item_id,
    itemName: row.item_name,
    itemPrice: parseFloat(row.item_price),
    quantity: row.quantity,
    unitPrice: parseFloat(row.unit_price),
    totalPrice: parseFloat(row.total_price),
    modifications: (row.modifications as OrderItem["modifications"]) ?? [],
    notes: row.notes,
    status: row.status as OrderItem["status"],
  };
}

function mapOrder(row: OrderRow, items: OrderItem[] = []): Order {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    sessionId: row.session_id,
    tableId: row.table_id,
    tableNumber: row.table_number,
    orderNumber: row.order_number,
    status: row.status as OrderStatus,
    type: row.type as Order["type"],
    subtotal: parseFloat(row.subtotal),
    taxAmount: parseFloat(row.tax_amount),
    serviceCharge: parseFloat(row.service_charge),
    discountAmount: parseFloat(row.discount_amount),
    totalAmount: parseFloat(row.total_amount),
    notes: row.notes,
    placedAt: row.placed_at.toISOString(),
    confirmedAt: row.confirmed_at?.toISOString() ?? null,
    readyAt: row.ready_at?.toISOString() ?? null,
    servedAt: row.served_at?.toISOString() ?? null,
    cancelledAt: row.cancelled_at?.toISOString() ?? null,
    items,
  };
}

// ── Helpers ───────────────────────────────────────────────────

async function generateOrderNumber(restaurantId: string): Promise<string> {
  const today = new Date();
  const prefix = `${today.getFullYear().toString().slice(2)}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
  const { rows } = await query<{ count: string }>(
    `SELECT COUNT(*) FROM orders WHERE restaurant_id = $1 AND DATE(placed_at) = CURRENT_DATE`,
    [restaurantId]
  );
  const seq = parseInt(rows[0]?.count ?? "0", 10) + 1;
  return `${prefix}-${String(seq).padStart(3, "0")}`;
}

async function fetchOrderItems(orderIds: string[]): Promise<Map<string, OrderItem[]>> {
  if (!orderIds.length) return new Map();
  const rows = await query<OrderItemRow>(
    `SELECT * FROM order_items WHERE order_id = ANY($1) ORDER BY created_at ASC`,
    [orderIds]
  );
  const map = new Map<string, OrderItem[]>();
  for (const row of rows) {
    const item = mapOrderItem(row);
    const list = map.get(item.orderId) ?? [];
    list.push(item);
    map.set(item.orderId, list);
  }
  return map;
}

// ── Service ───────────────────────────────────────────────────

export class OrderService {

  async placeOrder(
    restaurantId: string,
    dto: PlaceOrderDto
  ): Promise<Order> {
    return withTransaction(async (client) => {

      // 1. Validate session
      const { rows: [session] } = await client.query(
        `SELECT * FROM sessions WHERE session_token = $1 AND restaurant_id = $2 AND is_active = true`,
        [dto.sessionToken, restaurantId]
      );
      if (!session) {
        throw Object.assign(new Error("Session not found or expired"), { statusCode: 404 });
      }

      // 2. Load restaurant for tax/service settings
      const { rows: [restaurant] } = await client.query(
        `SELECT tax_rate, service_charge FROM restaurants WHERE id = $1`,
        [restaurantId]
      );
      const taxRate       = parseFloat(restaurant?.tax_rate ?? "0");
      const serviceRate   = parseFloat(restaurant?.service_charge ?? "0");

      // 3. Validate and price items
      const itemIds = dto.items.map(i => i.menuItemId);
      const { rows: menuItems } = await client.query(
        `SELECT id, name, price FROM menu_items WHERE id = ANY($1) AND restaurant_id = $2 AND is_available = true`,
        [itemIds, restaurantId]
      );
      const menuItemMap = new Map(menuItems.map((mi: { id: string; name: string; price: string }) => [mi.id, mi]));

      let subtotal = 0;
      const orderLineItems = dto.items.map(line => {
        const mi = menuItemMap.get(line.menuItemId);
        if (!mi) throw Object.assign(new Error(`Item ${line.menuItemId} not found or unavailable`), { statusCode: 400 });

        const modTotal = (line.modifications ?? []).reduce((sum: number, m) => sum + (m.priceDelta ?? 0), 0);
        const unitPrice  = parseFloat(mi.price) + modTotal;
        const totalPrice = unitPrice * line.quantity;
        subtotal += totalPrice;

        return {
          menuItemId: line.menuItemId,
          itemName:   mi.name,
          itemPrice:  parseFloat(mi.price),
          quantity:   line.quantity,
          unitPrice,
          totalPrice,
          modifications: JSON.stringify(line.modifications ?? []),
          notes: line.notes ?? null,
        };
      });

      const taxAmount     = subtotal * taxRate;
      const serviceAmount = subtotal * serviceRate;
      const totalAmount   = subtotal + taxAmount + serviceAmount;
      const orderNumber   = await generateOrderNumber(restaurantId);

      // 4. Insert order
      const { rows: [orderRow] } = await client.query<OrderRow>(
        `INSERT INTO orders
           (restaurant_id, session_id, table_id, order_number, status, type,
            subtotal, tax_amount, service_charge, total_amount, notes)
         VALUES ($1,$2,$3,$4,'pending',$5,$6,$7,$8,$9,$10)
         RETURNING *, (SELECT number FROM tables WHERE id = $3) AS table_number`,
        [
          restaurantId, session.id, session.table_id,
          orderNumber, dto.type ?? "dine_in",
          subtotal.toFixed(2), taxAmount.toFixed(2),
          serviceAmount.toFixed(2), totalAmount.toFixed(2),
          dto.notes ?? null,
        ]
      );

      // 5. Insert order items
      const insertedItems: OrderItem[] = [];
      for (const line of orderLineItems) {
        const { rows: [itemRow] } = await client.query<OrderItemRow>(
          `INSERT INTO order_items
             (order_id, item_id, item_name, item_price, quantity,
              unit_price, total_price, modifications, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           RETURNING *`,
          [
            orderRow.id, line.menuItemId, line.itemName, line.itemPrice,
            line.quantity, line.unitPrice, line.totalPrice,
            line.modifications, line.notes,
          ]
        );
        insertedItems.push(mapOrderItem(itemRow));
      }

      const order = mapOrder(orderRow, insertedItems);

      // 6. Emit real-time event
      emitNewOrder(order);

      return order;
    });
  }

  // ── Get order by id ─────────────────────────────────────────

  async getById(orderId: string, restaurantId: string): Promise<Order | null> {
    const row = await queryOne<OrderRow>(
      `SELECT o.*, t.number AS table_number
       FROM orders o
       LEFT JOIN tables t ON t.id = o.table_id
       WHERE o.id = $1 AND o.restaurant_id = $2`,
      [orderId, restaurantId]
    );
    if (!row) return null;
    const itemMap = await fetchOrderItems([orderId]);
    return mapOrder(row, itemMap.get(orderId) ?? []);
  }

  // ── Get orders for a diner session ─────────────────────────

  async getBySession(sessionToken: string, restaurantId: string): Promise<Order[]> {
    const rows = await query<OrderRow>(
      `SELECT o.*, t.number AS table_number
       FROM orders o
       LEFT JOIN tables t ON t.id = o.table_id
       JOIN sessions s ON s.id = o.session_id
       WHERE s.session_token = $1 AND o.restaurant_id = $2
       ORDER BY o.placed_at ASC`,
      [sessionToken, restaurantId]
    );
    if (!rows.length) return [];
    const itemMap = await fetchOrderItems(rows.map(r => r.id));
    return rows.map(r => mapOrder(r, itemMap.get(r.id) ?? []));
  }

  // ── List orders for restaurant (staff view) ─────────────────

  async listForRestaurant(
    restaurantId: string,
    opts: { status?: string; limit?: number; offset?: number } = {}
  ): Promise<{ orders: Order[]; total: number }> {
    const conditions = ["o.restaurant_id = $1"];
    const values: unknown[] = [restaurantId];
    let idx = 2;

    if (opts.status && opts.status !== "all") {
      conditions.push(`o.status = $${idx++}`);
      values.push(opts.status);
    }

    const where = conditions.join(" AND ");
    const limit  = opts.limit  ?? 50;
    const offset = opts.offset ?? 0;

    const [rows, countResult] = await Promise.all([
      query<OrderRow>(
        `SELECT o.*, t.number AS table_number
         FROM orders o
         LEFT JOIN tables t ON t.id = o.table_id
         WHERE ${where}
         ORDER BY o.placed_at DESC
         LIMIT $${idx++} OFFSET $${idx}`,
        [...values, limit, offset]
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) FROM orders o WHERE ${where}`,
        values
      ),
    ]);

    if (!rows.length) return { orders: [], total: 0 };
    const itemMap = await fetchOrderItems(rows.map(r => r.id));

    return {
      orders: rows.map(r => mapOrder(r, itemMap.get(r.id) ?? [])),
      total: parseInt(countResult[0]?.count ?? "0", 10),
    };
  }

  // ── Update order status ─────────────────────────────────────

  async updateStatus(
    orderId: string,
    restaurantId: string,
    status: OrderStatus
  ): Promise<Order> {
    const now = new Date().toISOString();
    const timestampCol: Partial<Record<OrderStatus, string>> = {
      confirmed:  "confirmed_at",
      ready:      "ready_at",
      served:     "served_at",
      cancelled:  "cancelled_at",
    };

    const extraSet = timestampCol[status] ? `, ${timestampCol[status]} = $3` : "";
    const values: unknown[] = [status, orderId, restaurantId];
    if (timestampCol[status]) values.splice(2, 0, now);

    const row = await queryOne<OrderRow>(
      `UPDATE orders SET status = $1${extraSet}
       WHERE id = $${extraSet ? 4 : 2} AND restaurant_id = $${extraSet ? 5 : 3}
       RETURNING *, (SELECT number FROM tables WHERE id = table_id) AS table_number`,
      extraSet ? [status, now, orderId, restaurantId] : [status, orderId, restaurantId]
    );
    if (!row) throw Object.assign(new Error("Order not found"), { statusCode: 404 });

    const itemMap = await fetchOrderItems([orderId]);
    const order   = mapOrder(row, itemMap.get(orderId) ?? []);

    // Emit real-time update
    emitOrderUpdated(order);

    // If order is served/cancelled, consider freeing the table
    if (status === "served" || status === "cancelled") {
      await this._maybeFreeTable(order, restaurantId);
    }

    return order;
  }

  // ── Free table when all orders are served/cancelled ─────────

  private async _maybeFreeTable(order: Order, restaurantId: string): Promise<void> {
    if (!order.tableId) return;

    const freeCheckRows = await query<{ active_count: string }>(
      `SELECT COUNT(*) AS active_count
       FROM orders
       WHERE table_id = $1 AND restaurant_id = $2
         AND status NOT IN ('served','cancelled')`,
      [order.tableId, restaurantId]
    );
    const active_count = freeCheckRows[0]?.active_count ?? "0";

    if (parseInt(active_count, 10) === 0) {
      await query(
        "UPDATE tables SET status = 'available' WHERE id = $1 AND restaurant_id = $2",
        [order.tableId, restaurantId]
      );
      emitTableStatusChanged(restaurantId, order.tableId, "available");
    }
  }

  // ── Today's stats ───────────────────────────────────────────

  async getTodayStats(restaurantId: string): Promise<{
    totalOrders: number;
    pendingOrders: number;
    totalRevenue: number;
    avgOrderValue: number;
  }> {
    const statsRows = await query<{
      total_orders: string;
      pending_orders: string;
      total_revenue: string;
    }>(
      `SELECT
         COUNT(*)                                            AS total_orders,
         COUNT(*) FILTER (WHERE status = 'pending')         AS pending_orders,
         COALESCE(SUM(total_amount) FILTER (WHERE status NOT IN ('cancelled')), 0) AS total_revenue
       FROM orders
       WHERE restaurant_id = $1 AND DATE(placed_at) = CURRENT_DATE`,
      [restaurantId]
    );
    const row = statsRows[0];

    const totalOrders   = parseInt(row?.total_orders  ?? "0", 10);
    const totalRevenue  = parseFloat(row?.total_revenue ?? "0");

    return {
      totalOrders,
      pendingOrders: parseInt(row?.pending_orders ?? "0", 10),
      totalRevenue,
      avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
    };
  }

// ── Kitchen methods (added Sprint 5) ─────────────────────────

  /**
   * List active orders for the kitchen display.
   * Returns pending/confirmed/preparing/ready orders — not served/cancelled.
   */
  async listKitchenOrders(restaurantId: string): Promise<Order[]> {
    const rows = await query<OrderRow>(
      `SELECT o.*, t.number AS table_number
       FROM orders o
       LEFT JOIN tables t ON t.id = o.table_id
       WHERE o.restaurant_id = $1
         AND o.status IN ('pending','confirmed','preparing','ready')
       ORDER BY o.placed_at ASC`,
      [restaurantId]
    );
    if (!rows.length) return [];
    const itemMap = await fetchOrderItems(rows.map((r) => r.id));
    return rows.map((r) => mapOrder(r, itemMap.get(r.id) ?? []));
  }

  /**
   * Update a single order item's status.
   * Auto-advances the parent order status based on item states.
   */
  async updateItemStatus(
    orderId: string,
    itemId: string,
    restaurantId: string,
    status: "pending" | "preparing" | "ready" | "served"
  ): Promise<{ order: Order; itemId: string; itemStatus: string }> {
    await query(
      `UPDATE order_items SET status = $1 WHERE id = $2 AND order_id = $3`,
      [status, itemId, orderId]
    );

    // Auto-advance order status based on item states
    const items = await query<{ status: string }>(
      `SELECT status FROM order_items WHERE order_id = $1`,
      [orderId]
    );

    const statuses = items.map((i) => i.status);
    let newOrderStatus: OrderStatus | null = null;

    if (statuses.every((s) => s === "ready" || s === "served")) {
      newOrderStatus = "ready";
    } else if (statuses.some((s) => s === "preparing" || s === "ready")) {
      newOrderStatus = "preparing";
    } else if (statuses.every((s) => s === "pending")) {
      newOrderStatus = "confirmed"; // stay confirmed when all still pending
    }

    if (newOrderStatus) {
      // Only advance — never go backwards
      const currentRow = await queryOne<{ status: string }>(
        `SELECT status FROM orders WHERE id = $1`,
        [orderId]
      );
      const ORDER_RANK: Record<string, number> = {
        pending: 0, confirmed: 1, preparing: 2, ready: 3, served: 4, cancelled: 5,
      };
      const currentRank = ORDER_RANK[currentRow?.status ?? "pending"] ?? 0;
      const newRank     = ORDER_RANK[newOrderStatus] ?? 0;

      if (newRank > currentRank) {
        await query(
          `UPDATE orders SET status = $1 WHERE id = $2 AND restaurant_id = $3`,
          [newOrderStatus, orderId, restaurantId]
        );
      }
    }

    // Emit item update
    const { emitOrderItemUpdated } = require("./socket.service");
    emitOrderItemUpdated(restaurantId, orderId, itemId, status);

    // Return the updated full order
    const updatedOrder = await this.getById(orderId, restaurantId);
    if (!updatedOrder) throw Object.assign(new Error("Order not found"), { statusCode: 404 });

    emitOrderUpdated(updatedOrder);
    return { order: updatedOrder, itemId, itemStatus: status };
  }

  /**
   * Kitchen stats snapshot.
   */
  async getKitchenStats(restaurantId: string): Promise<{
    pending: number; confirmed: number; preparing: number; ready: number; avgPrepSeconds: number;
  }> {
    const rows = await query<{ status: string; count: string }>(
      `SELECT status, COUNT(*) AS count
       FROM orders
       WHERE restaurant_id = $1 AND status IN ('pending','confirmed','preparing','ready')
       GROUP BY status`,
      [restaurantId]
    );

    const counts = Object.fromEntries(rows.map((r) => [r.status, parseInt(r.count, 10)]));

    const avgRows = await query<{ avg_seconds: string }>(
      `SELECT EXTRACT(EPOCH FROM AVG(confirmed_at - placed_at))::int AS avg_seconds
       FROM orders
       WHERE restaurant_id = $1
         AND status = 'ready'
         AND confirmed_at IS NOT NULL
         AND placed_at > NOW() - INTERVAL '24 hours'`,
      [restaurantId]
    );

    return {
      pending:        counts["pending"]   ?? 0,
      confirmed:      counts["confirmed"] ?? 0,
      preparing:      counts["preparing"] ?? 0,
      ready:          counts["ready"]     ?? 0,
      avgPrepSeconds: parseInt(avgRows[0]?.avg_seconds ?? "0", 10) || 0,
    };
  }
}

export const orderService = new OrderService();
