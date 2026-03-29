import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { tableService } from "../services/table.service";

// ── Schemas ───────────────────────────────────────────────────

const createAreaSchema = z.object({
  name: z.string().min(1).max(100),
  sortOrder: z.number().int().min(0).optional(),
});

const createTableSchema = z.object({
  areaId: z.string().uuid().optional(),
  number: z.string().min(1).max(20),
  name: z.string().max(100).optional(),
  capacity: z.number().int().min(1).max(50).optional(),
});

const TABLE_STATUSES = ["available", "occupied", "reserved", "cleaning"] as const;

// ── Controller ────────────────────────────────────────────────

export class TableController {

  // ── Areas ──────────────────────────────────────────────────

  async listAreas(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const areas = await tableService.listAreas(req.restaurantId!);
      res.json({ success: true, data: { areas } });
    } catch (err) { next(err); }
  }

  async createArea(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = createAreaSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: "VALIDATION_ERROR", message: "Invalid data", details: parsed.error.flatten().fieldErrors });
        return;
      }
      const area = await tableService.createArea(req.restaurantId!, parsed.data);
      res.status(201).json({ success: true, data: { area } });
    } catch (err) { next(err); }
  }

  async updateArea(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = createAreaSchema.partial().extend({ isActive: z.boolean().optional() }).safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: "VALIDATION_ERROR", message: "Invalid data", details: parsed.error.flatten().fieldErrors });
        return;
      }
      const area = await tableService.updateArea(req.params.id, req.restaurantId!, parsed.data);
      res.json({ success: true, data: { area } });
    } catch (err) { next(err); }
  }

  async deleteArea(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await tableService.deleteArea(req.params.id, req.restaurantId!);
      res.json({ success: true, data: { message: "Area deleted" } });
    } catch (err) { next(err); }
  }

  // ── Tables ─────────────────────────────────────────────────

  async listTables(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const areaId = req.query.areaId as string | undefined;
      const tables = await tableService.listTables(req.restaurantId!, areaId);
      res.json({ success: true, data: { tables } });
    } catch (err) { next(err); }
  }

  async getTable(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const table = await tableService.getTableById(req.params.id, req.restaurantId!);
      if (!table) { res.status(404).json({ success: false, error: "NOT_FOUND", message: "Table not found" }); return; }
      res.json({ success: true, data: { table } });
    } catch (err) { next(err); }
  }

  async createTable(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = createTableSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: "VALIDATION_ERROR", message: "Invalid data", details: parsed.error.flatten().fieldErrors });
        return;
      }
      const table = await tableService.createTable(req.restaurantId!, parsed.data);
      res.status(201).json({ success: true, data: { table } });
    } catch (err) { next(err); }
  }

  async updateTable(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = createTableSchema.partial().extend({ isActive: z.boolean().optional() }).safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: "VALIDATION_ERROR", message: "Invalid data", details: parsed.error.flatten().fieldErrors });
        return;
      }
      const table = await tableService.updateTable(req.params.id, req.restaurantId!, parsed.data);
      res.json({ success: true, data: { table } });
    } catch (err) { next(err); }
  }

  async updateTableStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status } = req.body as { status?: string };
      if (!status || !TABLE_STATUSES.includes(status as typeof TABLE_STATUSES[number])) {
        res.status(400).json({ success: false, error: "VALIDATION_ERROR", message: `Status must be one of: ${TABLE_STATUSES.join(", ")}` });
        return;
      }
      const table = await tableService.updateTableStatus(req.params.id, req.restaurantId!, status as typeof TABLE_STATUSES[number]);
      res.json({ success: true, data: { table } });
    } catch (err) { next(err); }
  }

  async deleteTable(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await tableService.deleteTable(req.params.id, req.restaurantId!);
      res.json({ success: true, data: { message: "Table deactivated" } });
    } catch (err) { next(err); }
  }

  // ── QR Code download ───────────────────────────────────────

  async downloadQrPng(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Public endpoint — no restaurantId, look up by ID only
      const { query } = await import("../db/pool");
      const rows = await query<{ qr_token: string; number: string }>(
        "SELECT qr_token, number FROM tables WHERE id = $1 AND is_active = true",
        [req.params.id]
      );
      const row = rows[0];
      if (!row) { res.status(404).json({ success: false, error: "NOT_FOUND", message: "Table not found" }); return; }

      const buffer = await tableService.getQrPngBuffer(row.qr_token);
      const filename = `table-${row.number}-qr.png`;

      res.setHeader("Content-Type", "image/png");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (err) { next(err); }
  }

  async downloadQrSvg(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Public endpoint — no restaurantId
      const { query } = await import("../db/pool");
      const rows = await query<{ qr_token: string; number: string }>(
        "SELECT qr_token, number FROM tables WHERE id = $1 AND is_active = true",
        [req.params.id]
      );
      const row = rows[0];
      if (!row) { res.status(404).json({ success: false, error: "NOT_FOUND", message: "Table not found" }); return; }

      const svg = await tableService.getQrSvg(row.qr_token);
      const filename = `table-${row.number}-qr.svg`;

      res.setHeader("Content-Type", "image/svg+xml");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(svg);
    } catch (err) { next(err); }
  }

  async regenerateQr(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await tableService.regenerateQr(req.params.id, req.restaurantId!);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  }
}

export const tableController = new TableController();
