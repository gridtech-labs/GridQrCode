import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import path from "path";

import authRoutes from "./routes/auth.routes";
import restaurantRoutes from "./routes/restaurant.routes";
import menuRoutes from "./routes/menu.routes";
import staffRoutes from "./routes/staff.routes";
import tableRoutes from "./routes/table.routes";
import dinerRoutes from "./routes/diner.routes";
import orderRoutes from "./routes/order.routes";
import kitchenRoutes from "./routes/kitchen.routes";
import billingRoutes from "./routes/billing.routes";
import analyticsRoutes from "./routes/analytics.routes";

import { errorHandler, notFoundHandler } from "./middleware/error.middleware";

const app = express();

// ── Security ──────────────────────────────────────────────────

app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
  })
);

const allowedOrigins = (process.env.APP_URL ?? "http://localhost:3000").split(",");

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Restaurant-Id"],
  })
);

// ── Global rate limit ─────────────────────────────────────────

app.use(
  rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 300,
    message: { success: false, error: "RATE_LIMIT_EXCEEDED", message: "Too many requests" },
    skip: (req) => req.path === "/api/v1/health",
  })
);

// ── Parsing ───────────────────────────────────────────────────

app.use(compression());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(cookieParser());
app.set("trust proxy", 1);

// ── Static uploads (local dev only) ──────────────────────────

app.use("/uploads", express.static(path.join(process.cwd(), "public", "uploads")));

// ── Health Check ──────────────────────────────────────────────

app.get("/api/v1/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? "0.1.0",
    sprint: "2 — Restaurant & Menu",
  });
});

// ── Routes ────────────────────────────────────────────────────

app.use("/api/v1/auth",       authRoutes);
app.use("/api/v1/restaurant", restaurantRoutes);
app.use("/api/v1/menu",       menuRoutes);
app.use("/api/v1/staff",      staffRoutes);
app.use("/api/v1/tables",     tableRoutes);
app.use("/api/v1/diner",      dinerRoutes);
app.use("/api/v1/orders",     orderRoutes);
app.use("/api/v1/kitchen",    kitchenRoutes);

// Sprint 5+ (uncomment as built):
// app.use("/api/v1/admin",      adminRoutes);

// ── Error Handling ────────────────────────────────────────────


// Sprint 6 (uncomment when Sprint 6 zip is applied):
app.use("/api/v1/billing",     billingRoutes);
app.use("/api/v1/analytics",   analyticsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
