import { query, queryOne } from "../db/pool";
import type { Plan, Subscription, UsageStats, BillingRecord } from "@qr-saas/shared";
import { QueryResultRow } from "pg";

interface PlanRow extends QueryResultRow {
  id: string;
  name: string;
  price_monthly: string;
  price_yearly: string;
  max_tables: number;
  max_menu_items: number;
  max_staff: number;
  features: Record<string, boolean>;
}

interface SubRow extends QueryResultRow {
  id: string;
  restaurant_id: string;
  plan_id: string;
  plan_name: string;
  status: string;
  billing_cycle: string;
  current_period_start: Date | null;
  current_period_end: Date | null;
  cancel_at_period_end: boolean;
  created_at: Date;
}

function mapPlan(row: PlanRow): Plan {
  const f = row.features ?? {};
  return {
    id: row.id,
    name: row.name,
    priceMonthly: parseFloat(row.price_monthly),
    priceYearly: parseFloat(row.price_yearly),
    maxTables: row.max_tables,
    maxMenuItems: row.max_menu_items,
    maxStaff: row.max_staff,
    features: {
      advancedAnalytics: !!f.advanced_analytics,
      customDomain:      !!f.custom_domain,
      whiteLabel:        !!f.white_label,
      prioritySupport:   !!f.priority_support,
      bulkQrDownload:    !!f.bulk_qr_download,
      apiAccess:         !!f.api_access,
    },
  };
}

function mapSub(row: SubRow): Subscription {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    planId: row.plan_id,
    planName: row.plan_name,
    status: row.status,
    billingCycle: row.billing_cycle as "monthly" | "yearly",
    currentPeriodStart: row.current_period_start?.toISOString() ?? null,
    currentPeriodEnd:   row.current_period_end?.toISOString()   ?? null,
    cancelAtPeriodEnd:  row.cancel_at_period_end,
    createdAt: row.created_at.toISOString(),
  };
}

export class BillingService {

  // ── Plans ─────────────────────────────────────────────────

  async listPlans(): Promise<Plan[]> {
    const rows = await query<PlanRow>(
      `SELECT * FROM plans WHERE is_active = true ORDER BY price_monthly ASC`
    );
    return rows.map(mapPlan);
  }

  async getPlanById(planId: string): Promise<Plan | null> {
    const row = await queryOne<PlanRow>(
      `SELECT * FROM plans WHERE id = $1 AND is_active = true`,
      [planId]
    );
    return row ? mapPlan(row) : null;
  }

  // ── Subscription ──────────────────────────────────────────

  async getSubscription(restaurantId: string): Promise<Subscription | null> {
    const row = await queryOne<SubRow>(
      `SELECT s.*, p.name AS plan_name
       FROM subscriptions s
       JOIN plans p ON p.id = s.plan_id
       WHERE s.restaurant_id = $1
       ORDER BY s.created_at DESC
       LIMIT 1`,
      [restaurantId]
    );
    return row ? mapSub(row) : null;
  }

  /**
   * Simulate a plan change (no real Stripe in dev).
   * Updates the subscriptions table and restaurant.plan_id.
   */
  async changePlan(
    restaurantId: string,
    planId: string,
    billingCycle: "monthly" | "yearly" = "monthly"
  ): Promise<Subscription> {
    const plan = await this.getPlanById(planId);
    if (!plan) throw Object.assign(new Error("Plan not found"), { statusCode: 404 });

    // Upsert subscription
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + (billingCycle === "yearly" ? 12 : 1));

    const existing = await this.getSubscription(restaurantId);

    let row: SubRow;
    if (existing) {
      const result = await queryOne<SubRow>(
        `UPDATE subscriptions
         SET plan_id = $1, status = 'active', billing_cycle = $2,
             current_period_start = $3, current_period_end = $4,
             cancel_at_period_end = false
         WHERE restaurant_id = $5
         RETURNING *, (SELECT name FROM plans WHERE id = $1) AS plan_name`,
        [planId, billingCycle, now.toISOString(), periodEnd.toISOString(), restaurantId]
      );
      row = result!;
    } else {
      const result = await queryOne<SubRow>(
        `INSERT INTO subscriptions
           (restaurant_id, plan_id, status, billing_cycle, current_period_start, current_period_end)
         VALUES ($1, $2, 'active', $3, $4, $5)
         RETURNING *, (SELECT name FROM plans WHERE id = $2) AS plan_name`,
        [restaurantId, planId, billingCycle, now.toISOString(), periodEnd.toISOString()]
      );
      row = result!;
    }

    // Update restaurant plan reference and subscription status
    await query(
      `UPDATE restaurants SET plan_id = $1, subscription_status = 'active' WHERE id = $2`,
      [planId, restaurantId]
    );

    return mapSub(row);
  }

  // ── Usage stats ───────────────────────────────────────────

  async getUsageStats(restaurantId: string): Promise<UsageStats> {
    const [tablesRow, itemsRow, staffRow, ordersRow] = await Promise.all([
      queryOne<{ used: string }>(
        `SELECT COUNT(*) AS used FROM tables WHERE restaurant_id = $1 AND is_active = true`,
        [restaurantId]
      ),
      queryOne<{ used: string }>(
        `SELECT COUNT(*) AS used FROM menu_items WHERE restaurant_id = $1 AND is_available = true`,
        [restaurantId]
      ),
      queryOne<{ used: string }>(
        `SELECT COUNT(*) AS used FROM users WHERE restaurant_id = $1 AND is_active = true`,
        [restaurantId]
      ),
      queryOne<{ orders: string; revenue: string }>(
        `SELECT
           COUNT(*) AS orders,
           COALESCE(SUM(total_amount) FILTER (WHERE status NOT IN ('cancelled')), 0) AS revenue
         FROM orders
         WHERE restaurant_id = $1
           AND placed_at >= DATE_TRUNC('month', NOW())`,
        [restaurantId]
      ),
    ]);

    // Get plan limits
    const limitsRow = await queryOne<{ max_tables: number; max_menu_items: number; max_staff: number }>(
      `SELECT p.max_tables, p.max_menu_items, p.max_staff
       FROM plans p
       JOIN restaurants r ON r.plan_id = p.id
       WHERE r.id = $1`,
      [restaurantId]
    );

    return {
      tables:    { used: parseInt(tablesRow?.used ?? "0", 10),  max: limitsRow?.max_tables    ?? 10  },
      menuItems: { used: parseInt(itemsRow?.used  ?? "0", 10),  max: limitsRow?.max_menu_items ?? 50  },
      staff:     { used: parseInt(staffRow?.used  ?? "0", 10),  max: limitsRow?.max_staff      ?? 3   },
      ordersThisMonth:  parseInt(ordersRow?.orders  ?? "0", 10),
      revenueThisMonth: parseFloat(ordersRow?.revenue ?? "0"),
    };
  }

  // ── Billing history (simulated — no Stripe yet) ───────────

  async getBillingHistory(restaurantId: string): Promise<BillingRecord[]> {
    const rows = await query<{
      id: string;
      created_at: Date;
      amount: string;
      currency: string;
      status: string;
      method: string | null;
    }>(
      `SELECT p.id, p.created_at, p.amount, p.currency, p.status, p.method
       FROM payments p
       JOIN orders o ON o.id = p.order_id
       WHERE p.restaurant_id = $1
       ORDER BY p.created_at DESC
       LIMIT 24`,
      [restaurantId]
    );

    // Also include subscription records if any
    const sub = await this.getSubscription(restaurantId);

    const records: BillingRecord[] = rows.map((r) => ({
      id: r.id,
      date: r.created_at.toISOString(),
      description: "Order payment",
      amount: parseFloat(r.amount),
      currency: r.currency,
      status: r.status as BillingRecord["status"],
    }));

    if (sub?.currentPeriodStart) {
      records.unshift({
        id: `sub-${sub.id}`,
        date: sub.currentPeriodStart,
        description: `${sub.planName} plan — ${sub.billingCycle}`,
        amount: 0, // no real Stripe charge in dev
        currency: "USD",
        status: "paid",
      });
    }

    return records;
  }
}

export const billingService = new BillingService();
