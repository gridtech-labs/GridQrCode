#!/usr/bin/env ts-node
/**
 * Database migration runner.
 * Executes all .sql files in /migrations in filename order.
 * Tracks applied migrations in a `_migrations` meta-table.
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import pool from "./pool";

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

async function run(): Promise<void> {
  const client = await pool.connect();

  try {
    // Ensure meta-table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id         SERIAL PRIMARY KEY,
        filename   VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    // Read & sort migration files
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const { rows } = await client.query(
        "SELECT id FROM _migrations WHERE filename = $1",
        [file]
      );

      if (rows.length > 0) {
        console.log(`  ✓ ${file} (already applied)`);
        continue;
      }

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");

      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        "INSERT INTO _migrations (filename) VALUES ($1)",
        [file]
      );
      await client.query("COMMIT");

      console.log(`  ✅ ${file}`);
    }

    // Set real super admin password from env
    const adminEmail = process.env.SUPER_ADMIN_EMAIL ?? "admin@qrsaas.com";
    const adminPassword = process.env.SUPER_ADMIN_PASSWORD ?? "changeme";
    const hash = await bcrypt.hash(adminPassword, 12);
    await client.query(
      "UPDATE users SET password_hash = $1 WHERE email = $2",
      [hash, adminEmail]
    );
    console.log(`  🔐 Super admin password set for ${adminEmail}`);

    console.log("\n✅ All migrations applied successfully.\n");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("❌ Migration failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
