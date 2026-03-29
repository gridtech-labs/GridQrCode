import { Router } from "express";
import { tableController } from "../controllers/table.controller";
import { authenticate } from "../middleware/auth.middleware";
import { requireTenant } from "../middleware/tenant.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

// ── QR image downloads are PUBLIC ────────────────────────────
// <img> tags cannot send Authorization headers.
// The table ID in the URL is not sensitive — the QR image is
// just a PNG of a URL. Security is enforced by the diner token.
router.get("/:id/qr.png", tableController.downloadQrPng.bind(tableController));
router.get("/:id/qr.svg", tableController.downloadQrSvg.bind(tableController));

// ── Everything else requires auth + tenant ────────────────────
router.use(authenticate, requireTenant);

// ── Areas ─────────────────────────────────────────────────────
router.get("/areas",                    tableController.listAreas.bind(tableController));
router.post("/areas",     requireRole("manager"), tableController.createArea.bind(tableController));
router.patch("/areas/:id",requireRole("manager"), tableController.updateArea.bind(tableController));
router.delete("/areas/:id",requireRole("manager"),tableController.deleteArea.bind(tableController));

// ── Tables ────────────────────────────────────────────────────
router.get("/",                         tableController.listTables.bind(tableController));
router.get("/:id",                      tableController.getTable.bind(tableController));
router.post("/",           requireRole("manager"), tableController.createTable.bind(tableController));
router.patch("/:id",       requireRole("manager"), tableController.updateTable.bind(tableController));
router.delete("/:id",      requireRole("manager"), tableController.deleteTable.bind(tableController));
router.patch("/:id/status", requireRole("staff"),  tableController.updateTableStatus.bind(tableController));

// ── QR regeneration still requires auth ──────────────────────
router.post("/:id/qr/regenerate", requireRole("manager"), tableController.regenerateQr.bind(tableController));

export default router;
