import QRCode from "qrcode";
import { query, queryOne, withTransaction } from "../db/pool";
import { storageService } from "./storage.service";
import type {
  Area, Table, QrCode, DinerSession, DinerScanResult,
  CreateAreaDto, UpdateAreaDto,
  CreateTableDto, UpdateTableDto,
} from "@qr-saas/shared";
import { QueryResultRow } from "pg";

// ── Row types ─────────────────────────────────────────────────

interface AreaRow extends QueryResultRow {
  id: string;
  restaurant_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  table_count?: string;
}

interface TableRow extends QueryResultRow {
  id: string;
  restaurant_id: string;
  area_id: string | null;
  area_name: string | null;
  number: string;
  name: string | null;
  capacity: number;
  status: string;
  qr_code_url: string | null;
  qr_token: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface QrCodeRow extends QueryResultRow {
  id: string;
  restaurant_id: string;
  table_id: string | null;
  token: string;
  url: string;
  image_url: string | null;
  scan_count: number;
  last_scanned: Date | null;
  is_active: boolean;
  created_at: Date;
}

// ── Mappers ───────────────────────────────────────────────────

function mapArea(row: AreaRow): Area {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    name: row.name,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    tableCount: row.table_count ? parseInt(row.table_count, 10) : undefined,
  };
}

function mapTable(row: TableRow): Table {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    areaId: row.area_id,
    areaName: row.area_name,
    number: row.number,
    name: row.name,
    capacity: row.capacity,
    status: row.status as Table["status"],
    qrCodeUrl: row.qr_code_url,
    qrToken: row.qr_token,
    isActive: row.is_active,
    createdAt: row.created_at.toISOString(),
  };
}

// ── QR Helpers ────────────────────────────────────────────────

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

function buildDinerUrl(qrToken: string): string {
  return `${APP_URL}/r/${qrToken}`;
}

async function generateQrPng(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, {
    type: "png",
    width: 512,
    margin: 2,
    color: { dark: "#0F172A", light: "#FFFFFF" },
    errorCorrectionLevel: "M",
  });
}

async function generateQrSvg(url: string): Promise<string> {
  return QRCode.toString(url, {
    type: "svg",
    margin: 2,
    color: { dark: "#0F172A", light: "#FFFFFF" },
    errorCorrectionLevel: "M",
  });
}

// ── Table Service ─────────────────────────────────────────────

export class TableService {

  // ── Areas ──────────────────────────────────────────────────

  async listAreas(restaurantId: string): Promise<Area[]> {
    const rows = await query<AreaRow>(
      `SELECT a.*,
              COUNT(t.id) FILTER (WHERE t.is_active = true) AS table_count
       FROM areas a
       LEFT JOIN tables t ON t.area_id = a.id
       WHERE a.restaurant_id = $1
       GROUP BY a.id
       ORDER BY a.sort_order ASC, a.name ASC`,
      [restaurantId]
    );
    return rows.map(mapArea);
  }

  async createArea(restaurantId: string, dto: CreateAreaDto): Promise<Area> {
    const row = await queryOne<AreaRow>(
      `INSERT INTO areas (restaurant_id, name, sort_order)
       VALUES ($1, $2, $3) RETURNING *`,
      [restaurantId, dto.name, dto.sortOrder ?? 0]
    );
    return mapArea(row!);
  }

  async updateArea(id: string, restaurantId: string, dto: UpdateAreaDto): Promise<Area> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (dto.name !== undefined)      { fields.push(`name = $${idx++}`);       values.push(dto.name); }
    if (dto.sortOrder !== undefined) { fields.push(`sort_order = $${idx++}`); values.push(dto.sortOrder); }
    if (dto.isActive !== undefined)  { fields.push(`is_active = $${idx++}`);  values.push(dto.isActive); }

    if (fields.length === 0) return (await this.listAreas(restaurantId)).find(a => a.id === id)!;

    values.push(id, restaurantId);
    const row = await queryOne<AreaRow>(
      `UPDATE areas SET ${fields.join(", ")} WHERE id = $${idx++} AND restaurant_id = $${idx} RETURNING *`,
      values
    );
    if (!row) throw Object.assign(new Error("Area not found"), { statusCode: 404 });
    return mapArea(row);
  }

  async deleteArea(id: string, restaurantId: string): Promise<void> {
    // Unlink tables before deleting area
    await query("UPDATE tables SET area_id = NULL WHERE area_id = $1 AND restaurant_id = $2", [id, restaurantId]);
    await query("DELETE FROM areas WHERE id = $1 AND restaurant_id = $2", [id, restaurantId]);
  }

  // ── Tables ─────────────────────────────────────────────────

  async listTables(restaurantId: string, areaId?: string): Promise<Table[]> {
    const conditions = ["t.restaurant_id = $1", "t.is_active = true"];
    const values: unknown[] = [restaurantId];

    if (areaId) {
      conditions.push(`t.area_id = $2`);
      values.push(areaId);
    }

    const rows = await query<TableRow>(
      `SELECT t.*, a.name AS area_name
       FROM tables t
       LEFT JOIN areas a ON a.id = t.area_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY t.number ASC`,
      values
    );
    return rows.map(mapTable);
  }

  async getTableById(id: string, restaurantId: string): Promise<Table | null> {
    const row = await queryOne<TableRow>(
      `SELECT t.*, a.name AS area_name
       FROM tables t
       LEFT JOIN areas a ON a.id = t.area_id
       WHERE t.id = $1 AND t.restaurant_id = $2`,
      [id, restaurantId]
    );
    return row ? mapTable(row) : null;
  }

  async getTableByToken(qrToken: string): Promise<TableRow | null> {
    return queryOne<TableRow>(
      "SELECT * FROM tables WHERE qr_token = $1 AND is_active = true",
      [qrToken]
    );
  }

  async createTable(restaurantId: string, dto: CreateTableDto): Promise<Table> {
    return withTransaction(async (client) => {
      // Insert table — qr_token auto-generated by DB default
      const { rows: [tableRow] } = await client.query<TableRow>(
        `INSERT INTO tables (restaurant_id, area_id, number, name, capacity)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [restaurantId, dto.areaId ?? null, dto.number, dto.name ?? null, dto.capacity ?? 4]
      );

      // Generate and store QR code
      const dinerUrl = buildDinerUrl(tableRow.qr_token);
      const pngBuffer = await generateQrPng(dinerUrl);

      let qrImageUrl: string | null = null;
      try {
        const result = await storageService.uploadImage(
          pngBuffer,
          restaurantId,
          "qr-codes",
          "logo" // 400×400 — good for QR codes
        );
        qrImageUrl = result.url;
      } catch {
        // Non-fatal — QR can still be generated on demand
      }

      // Store in qr_codes table
      await client.query(
        `INSERT INTO qr_codes (restaurant_id, table_id, token, url, image_url)
         VALUES ($1, $2, $3, $4, $5)`,
        [restaurantId, tableRow.id, tableRow.qr_token, dinerUrl, qrImageUrl]
      );

      // Update table with qr_code_url
      if (qrImageUrl) {
        await client.query(
          "UPDATE tables SET qr_code_url = $1 WHERE id = $2",
          [qrImageUrl, tableRow.id]
        );
        tableRow.qr_code_url = qrImageUrl;
      }

      tableRow.area_name = null;
      if (dto.areaId) {
        const { rows: [area] } = await client.query<{ name: string }>(
          "SELECT name FROM areas WHERE id = $1",
          [dto.areaId]
        );
        tableRow.area_name = area?.name ?? null;
      }

      return mapTable(tableRow);
    });
  }

  async updateTable(id: string, restaurantId: string, dto: UpdateTableDto): Promise<Table> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (dto.areaId !== undefined)   { fields.push(`area_id = $${idx++}`);   values.push(dto.areaId || null); }
    if (dto.number !== undefined)   { fields.push(`number = $${idx++}`);    values.push(dto.number); }
    if (dto.name !== undefined)     { fields.push(`name = $${idx++}`);      values.push(dto.name || null); }
    if (dto.capacity !== undefined) { fields.push(`capacity = $${idx++}`);  values.push(dto.capacity); }
    if (dto.isActive !== undefined) { fields.push(`is_active = $${idx++}`); values.push(dto.isActive); }

    if (fields.length === 0) return (await this.getTableById(id, restaurantId))!;

    values.push(id, restaurantId);
    await query(
      `UPDATE tables SET ${fields.join(", ")} WHERE id = $${idx++} AND restaurant_id = $${idx}`,
      values
    );

    const updated = await this.getTableById(id, restaurantId);
    if (!updated) throw Object.assign(new Error("Table not found"), { statusCode: 404 });
    return updated;
  }

  async updateTableStatus(id: string, restaurantId: string, status: Table["status"]): Promise<Table> {
    const row = await queryOne<TableRow>(
      `UPDATE tables SET status = $1
       WHERE id = $2 AND restaurant_id = $3
       RETURNING *`,
      [status, id, restaurantId]
    );
    if (!row) throw Object.assign(new Error("Table not found"), { statusCode: 404 });
    return mapTable(row);
  }

  async deleteTable(id: string, restaurantId: string): Promise<void> {
    await query(
      "UPDATE tables SET is_active = false WHERE id = $1 AND restaurant_id = $2",
      [id, restaurantId]
    );
  }

  // ── QR Code ────────────────────────────────────────────────

  async regenerateQr(tableId: string, restaurantId: string): Promise<{ url: string; imageUrl: string | null }> {
    const table = await this.getTableById(tableId, restaurantId);
    if (!table) throw Object.assign(new Error("Table not found"), { statusCode: 404 });

    const dinerUrl = buildDinerUrl(table.qrToken);
    const pngBuffer = await generateQrPng(dinerUrl);

    let imageUrl: string | null = null;
    try {
      const result = await storageService.uploadImage(pngBuffer, restaurantId, "qr-codes", "logo");
      imageUrl = result.url;

      // Update stored URL
      await query(
        `UPDATE qr_codes SET image_url = $1, version = version + 1 WHERE table_id = $2`,
        [imageUrl, tableId]
      );
      await query(
        `UPDATE tables SET qr_code_url = $1 WHERE id = $2`,
        [imageUrl, tableId]
      );
    } catch {
      // Return URL even if storage fails
    }

    return { url: dinerUrl, imageUrl };
  }

  /**
   * Generate QR PNG buffer on-demand (for direct download — no storage needed).
   */
  async getQrPngBuffer(qrToken: string): Promise<Buffer> {
    const url = buildDinerUrl(qrToken);
    return generateQrPng(url);
  }

  /**
   * Generate QR SVG string on-demand.
   */
  async getQrSvg(qrToken: string): Promise<string> {
    const url = buildDinerUrl(qrToken);
    return generateQrSvg(url);
  }

  // ── Diner: public scan flow ───────────────────────────────

  async handleQrScan(
    qrToken: string,
    meta: { ipAddress?: string; userAgent?: string }
  ): Promise<DinerScanResult> {
    return withTransaction(async (client) => {

      // 1. Find table by qr_token
      const { rows: [tableRow] } = await client.query<TableRow>(
        `SELECT t.*, a.name AS area_name
         FROM tables t
         LEFT JOIN areas a ON a.id = t.area_id
         WHERE t.qr_token = $1 AND t.is_active = true`,
        [qrToken]
      );

      if (!tableRow) {
        throw Object.assign(new Error("QR code not found or inactive"), { statusCode: 404 });
      }

      // 2. Get restaurant
      const { rows: [restaurant] } = await client.query(
        `SELECT id, name, slug, logo_url, cover_url, description, currency, settings
         FROM restaurants WHERE id = $1 AND is_active = true`,
        [tableRow.restaurant_id]
      );

      if (!restaurant) {
        throw Object.assign(new Error("Restaurant not found"), { statusCode: 404 });
      }

      // 3. Record the scan
      const { rows: [qrCode] } = await client.query<{ id: string }>(
        `UPDATE qr_codes
         SET scan_count = scan_count + 1, last_scanned = NOW()
         WHERE table_id = $1 AND is_active = true
         RETURNING id`,
        [tableRow.id]
      );

      if (qrCode) {
        await client.query(
          `INSERT INTO qr_scans (qr_code_id, ip_address, user_agent)
           VALUES ($1, $2, $3)`,
          [qrCode.id, meta.ipAddress ?? null, meta.userAgent ?? null]
        );
      }

      // 4. Create or reuse an active diner session for this table
      const { rows: [existingSession] } = await client.query(
        `SELECT * FROM sessions
         WHERE table_id = $1 AND is_active = true AND closed_at IS NULL
         ORDER BY opened_at DESC LIMIT 1`,
        [tableRow.id]
      );

      let session = existingSession;
      if (!session) {
        const sessionToken = require("crypto").randomBytes(24).toString("hex");
        const { rows: [newSession] } = await client.query(
          `INSERT INTO sessions (restaurant_id, table_id, session_token)
           VALUES ($1, $2, $3) RETURNING *`,
          [tableRow.restaurant_id, tableRow.id, sessionToken]
        );
        session = newSession;
      }

      // 5. Mark table as occupied if it was available
      if (tableRow.status === "available") {
        await client.query(
          "UPDATE tables SET status = 'occupied' WHERE id = $1",
          [tableRow.id]
        );
      }

      // 6. Fetch menu (available items only)
      const { rows: categories } = await client.query(
        `SELECT * FROM menu_categories
         WHERE restaurant_id = $1 AND is_active = true
         ORDER BY sort_order ASC, name ASC`,
        [tableRow.restaurant_id]
      );

      const { rows: items } = await client.query(
        `SELECT i.*, c.name AS category_name
         FROM menu_items i
         LEFT JOIN menu_categories c ON c.id = i.category_id
         WHERE i.restaurant_id = $1 AND i.is_available = true
         ORDER BY i.sort_order ASC, i.name ASC`,
        [tableRow.restaurant_id]
      );

      return {
        session: {
          id: session.id,
          restaurantId: session.restaurant_id,
          tableId: session.table_id,
          sessionToken: session.session_token,
          openedAt: session.opened_at.toISOString(),
          isActive: session.is_active,
        },
        restaurant: {
          id: restaurant.id,
          name: restaurant.name,
          slug: restaurant.slug,
          logoUrl: restaurant.logo_url,
          coverUrl: restaurant.cover_url,
          description: restaurant.description,
          currency: restaurant.currency,
          settings: restaurant.settings ?? {},
        },
        table: tableRow ? {
          id: tableRow.id,
          number: tableRow.number,
          name: tableRow.name,
          capacity: tableRow.capacity,
        } : null,
        menu: {
          categories: categories.map((c) => ({
            id: c.id,
            restaurantId: c.restaurant_id,
            name: c.name,
            description: c.description,
            imageUrl: c.image_url,
            sortOrder: c.sort_order,
            isActive: c.is_active,
            availableFrom: c.available_from,
            availableUntil: c.available_until,
          })),
          items: items.map((i) => ({
            id: i.id,
            restaurantId: i.restaurant_id,
            categoryId: i.category_id,
            categoryName: i.category_name,
            name: i.name,
            description: i.description,
            price: parseFloat(i.price),
            imageUrl: i.image_url,
            tags: i.tags ?? [],
            allergens: i.allergens ?? [],
            calories: i.calories,
            prepTimeMin: i.prep_time_min,
            isAvailable: i.is_available,
            isFeatured: i.is_featured,
            sortOrder: i.sort_order,
            createdAt: i.created_at.toISOString(),
            updatedAt: i.updated_at.toISOString(),
          })),
        },
      };
    });
  }
}

export const tableService = new TableService();
