import { query } from "../db/pool";
import { QueryResultRow } from "pg";

interface DayRow extends QueryResultRow {
  day: string;
  orders: string;
  revenue: string;
}

interface TopItemRow extends QueryResultRow {
  item_name: string;
  total_sold: string;
  total_revenue: string;
}

interface HourRow extends QueryResultRow {
  hour: string;
  orders: string;
}

interface StatusRow extends QueryResultRow {
  status: string;
  count: string;
}

export class AnalyticsService {

  async getDashboardStats(restaurantId: string, days = 30) {
    const [revenueRows, topItems, hourlyRows, statusRows, tableScanRows] = await Promise.all([
      // Daily revenue for the last N days
      query<DayRow>(
        `SELECT
           TO_CHAR(placed_at, 'YYYY-MM-DD') AS day,
           COUNT(*) AS orders,
           COALESCE(SUM(total_amount) FILTER (WHERE status != 'cancelled'), 0) AS revenue
         FROM orders
         WHERE restaurant_id = $1
           AND placed_at >= NOW() - INTERVAL '${days} days'
         GROUP BY day
         ORDER BY day ASC`,
        [restaurantId]
      ),

      // Top selling menu items
      query<TopItemRow>(
        `SELECT
           oi.item_name,
           SUM(oi.quantity) AS total_sold,
           SUM(oi.total_price) AS total_revenue
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         WHERE o.restaurant_id = $1
           AND o.status NOT IN ('cancelled')
           AND o.placed_at >= NOW() - INTERVAL '${days} days'
         GROUP BY oi.item_name
         ORDER BY total_sold DESC
         LIMIT 8`,
        [restaurantId]
      ),

      // Orders by hour of day (peak times)
      query<HourRow>(
        `SELECT
           EXTRACT(HOUR FROM placed_at)::int AS hour,
           COUNT(*) AS orders
         FROM orders
         WHERE restaurant_id = $1
           AND placed_at >= NOW() - INTERVAL '${days} days'
           AND status != 'cancelled'
         GROUP BY hour
         ORDER BY hour ASC`,
        [restaurantId]
      ),

      // Orders by status
      query<StatusRow>(
        `SELECT status, COUNT(*) AS count
         FROM orders
         WHERE restaurant_id = $1
           AND placed_at >= NOW() - INTERVAL '${days} days'
         GROUP BY status`,
        [restaurantId]
      ),

      // QR scan count
      query<{ total_scans: string }>(
        `SELECT COUNT(*) AS total_scans
         FROM qr_scans qs
         JOIN qr_codes qc ON qc.id = qs.qr_code_id
         WHERE qc.restaurant_id = $1
           AND qs.scanned_at >= NOW() - INTERVAL '${days} days'`,
        [restaurantId]
      ),
    ]);

    const totalRevenue   = revenueRows.reduce((s, r) => s + parseFloat(r.revenue), 0);
    const totalOrders    = revenueRows.reduce((s, r) => s + parseInt(r.orders, 10), 0);
    const statusMap      = Object.fromEntries(statusRows.map((r) => [r.status, parseInt(r.count, 10)]));
    const cancelledCount = statusMap["cancelled"] ?? 0;
    const completedCount = statusMap["served"] ?? 0;
    const totalScans     = parseInt(tableScanRows[0]?.total_scans ?? "0", 10);

    return {
      summary: {
        totalRevenue,
        totalOrders,
        avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        completedOrders: completedCount,
        cancelledOrders: cancelledCount,
        cancellationRate: totalOrders > 0 ? (cancelledCount / totalOrders) * 100 : 0,
        totalQrScans: totalScans,
      },
      dailyRevenue: revenueRows.map((r) => ({
        day: r.day,
        orders: parseInt(r.orders, 10),
        revenue: parseFloat(r.revenue),
      })),
      topItems: topItems.map((r) => ({
        name: r.item_name,
        sold: parseInt(r.total_sold, 10),
        revenue: parseFloat(r.total_revenue),
      })),
      hourlyOrders: (() => {
        const map = Object.fromEntries(hourlyRows.map((r) => [parseInt(r.hour, 10), parseInt(r.orders, 10)]));
        return Array.from({ length: 24 }, (_, h) => ({ hour: h, orders: map[h] ?? 0 }));
      })(),
    };
  }
}

export const analyticsService = new AnalyticsService();
