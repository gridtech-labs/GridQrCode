import "dotenv/config";

import { validateEnv } from "./utils/validateEnv";

validateEnv();

import app from "./app";
import pool from "./db/pool";
import { initSocketIO } from "./services/socket.service";

const PORT = parseInt(process.env.PORT ?? "3001", 10);

async function bootstrap(): Promise<void> {
  // Verify DB connection
  try {
    const client = await pool.connect();
    client.release();
    console.log("✅ PostgreSQL connected");
  } catch (err) {
    console.error("❌ PostgreSQL connection failed:", err);
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    console.log(`🚀 API server running on http://localhost:${PORT}`);
    console.log(`   Environment: ${process.env.NODE_ENV ?? "development"}`);
  });
// Attach Socket.IO to the same HTTP server
  initSocketIO(server);
  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received. Shutting down gracefully…`);
    server.close(async () => {
      await pool.end();
      console.log("✅ Server closed. DB pool drained.");
      process.exit(0);
    });

    // Force exit after 10s
    setTimeout(() => {
      console.error("Force exit after timeout");
      process.exit(1);
    }, 10_000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

bootstrap();
