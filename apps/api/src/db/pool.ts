import { Pool, PoolClient, QueryResultRow } from "pg";
import dotenv from "dotenv";
import path from "path";

// ── Connection Pool ───────────────────────────────────────────



dotenv.config({
  path: path.resolve(__dirname, "../../../../.env"),
});
console.log("DATABASE_URL =", process.env.DATABASE_URL);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL pool error:", err);
  process.exit(1);
});

// ── Helpers ───────────────────────────────────────────────────

/**
 * Run a single parameterised query and return rows.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const start = Date.now();
  const result = await pool.query<T>(text, params);
  const duration = Date.now() - start;

  if (process.env.NODE_ENV === "development" && duration > 200) {
    console.warn(`⚠️  Slow query (${duration}ms): ${text.slice(0, 80)}`);
  }

  return result.rows;
}

/**
 * Run a query expected to return exactly one row (throws if 0 rows).
 */
export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/**
 * Acquire a client for transactions.
 * Always call client.release() in a finally block.
 */
export async function getClient(): Promise<PoolClient> {
  return pool.connect();
}

/**
 * Helper to run a set of operations inside a transaction.
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getClient();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export default pool;
