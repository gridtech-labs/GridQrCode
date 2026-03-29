import { query, queryOne, withTransaction } from "../db/pool";
import { storageService, ImagePreset } from "./storage.service";
import type {
  Restaurant,
  UpdateRestaurantDto,
} from "@qr-saas/shared";
import { QueryResultRow } from "pg";

// ── Row types ─────────────────────────────────────────────────

interface RestaurantRow extends QueryResultRow {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  cover_url: string | null;
  description: string | null;
  address: Record<string, unknown> | null;
  phone: string | null;
  email: string | null;
  currency: string;
  timezone: string;
  tax_rate: string;
  service_charge: string;
  settings: Record<string, unknown>;
  subscription_status: string;
  trial_ends_at: Date | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  plan_name: string | null;
  max_tables: number | null;
  max_menu_items: number | null;
}

// ── Mapper ────────────────────────────────────────────────────

function mapRow(row: RestaurantRow): Restaurant & { planName?: string | null; maxTables?: number | null; maxMenuItems?: number | null } {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    logoUrl: row.logo_url,
    coverUrl: row.cover_url,
    description: row.description,
    address: row.address as Restaurant["address"],
    phone: row.phone,
    email: row.email,
    currency: row.currency,
    timezone: row.timezone,
    taxRate: parseFloat(row.tax_rate),
    serviceCharge: parseFloat(row.service_charge),
    settings: row.settings ?? {},
    subscriptionStatus: row.subscription_status as Restaurant["subscriptionStatus"],
    trialEndsAt: row.trial_ends_at?.toISOString() ?? null,
    isActive: row.is_active,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    planName: row.plan_name,
    maxTables: row.max_tables,
    maxMenuItems: row.max_menu_items,
  };
}

const SELECT_RESTAURANT = `
  SELECT r.*,
         p.name   AS plan_name,
         p.max_tables,
         p.max_menu_items
  FROM restaurants r
  LEFT JOIN plans p ON p.id = r.plan_id
`;

// ── Service ───────────────────────────────────────────────────

export class RestaurantService {
  async getById(restaurantId: string): Promise<ReturnType<typeof mapRow> | null> {
    const row = await queryOne<RestaurantRow>(
      `${SELECT_RESTAURANT} WHERE r.id = $1`,
      [restaurantId]
    );
    return row ? mapRow(row) : null;
  }

  async getBySlug(slug: string): Promise<ReturnType<typeof mapRow> | null> {
    const row = await queryOne<RestaurantRow>(
      `${SELECT_RESTAURANT} WHERE r.slug = $1 AND r.is_active = true`,
      [slug]
    );
    return row ? mapRow(row) : null;
  }

  async update(
    restaurantId: string,
    dto: UpdateRestaurantDto
  ): Promise<ReturnType<typeof mapRow>> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    const addField = (col: string, val: unknown) => {
      fields.push(`${col} = $${idx++}`);
      values.push(val);
    };

    if (dto.name !== undefined)          addField("name", dto.name);
    if (dto.description !== undefined)   addField("description", dto.description);
    if (dto.phone !== undefined)         addField("phone", dto.phone);
    if (dto.email !== undefined)         addField("email", dto.email);
    if (dto.currency !== undefined)      addField("currency", dto.currency);
    if (dto.timezone !== undefined)      addField("timezone", dto.timezone);
    if (dto.taxRate !== undefined)       addField("tax_rate", dto.taxRate);
    if (dto.serviceCharge !== undefined) addField("service_charge", dto.serviceCharge);
    if (dto.address !== undefined)       addField("address", JSON.stringify(dto.address));
    if (dto.settings !== undefined) {
      // Deep merge into existing settings JSONB
      fields.push(`settings = settings::jsonb || $${idx++}::jsonb`);
      values.push(JSON.stringify(dto.settings));
    }

    if (fields.length === 0) {
      const existing = await this.getById(restaurantId);
      if (!existing) throw Object.assign(new Error("Restaurant not found"), { statusCode: 404 });
      return existing;
    }

    values.push(restaurantId);
    const rows = await query<RestaurantRow>(
      `UPDATE restaurants SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (!rows[0]) throw Object.assign(new Error("Restaurant not found"), { statusCode: 404 });

    // Re-fetch with plan join
    return (await this.getById(restaurantId))!;
  }

  async uploadLogo(
    restaurantId: string,
    buffer: Buffer,
    preset: ImagePreset = "logo"
  ): Promise<string> {
    // Delete old logo if exists
    const existing = await this.getById(restaurantId);
    if (existing?.logoUrl) {
      // Best effort — ignore errors
      storageService.deleteObject(existing.logoUrl).catch(() => {});
    }

    const result = await storageService.uploadImage(buffer, restaurantId, "logos", preset);

    await query(
      "UPDATE restaurants SET logo_url = $1 WHERE id = $2",
      [result.url, restaurantId]
    );

    return result.url;
  }

  async uploadCover(restaurantId: string, buffer: Buffer): Promise<string> {
    const existing = await this.getById(restaurantId);
    if (existing?.coverUrl) {
      storageService.deleteObject(existing.coverUrl).catch(() => {});
    }

    const result = await storageService.uploadImage(buffer, restaurantId, "covers", "cover");

    await query(
      "UPDATE restaurants SET cover_url = $1 WHERE id = $2",
      [result.url, restaurantId]
    );

    return result.url;
  }

  // ── Admin: list all (super admin only) ───────────────────────

  async listAll(page = 1, limit = 20): Promise<{ restaurants: ReturnType<typeof mapRow>[]; total: number }> {
    const offset = (page - 1) * limit;
    const rows = await query<RestaurantRow>(
      `${SELECT_RESTAURANT} ORDER BY r.created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    const [{ count }] = await query<{ count: string }>(
      "SELECT COUNT(*) FROM restaurants"
    );
    return {
      restaurants: rows.map(mapRow),
      total: parseInt(count, 10),
    };
  }
}

export const restaurantService = new RestaurantService();
