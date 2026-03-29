/**
 * Validates required environment variables before the server starts.
 * In development: logs warnings but does NOT exit.
 * In production: exits immediately with a clear error list.
 */

interface EnvVar {
  name: string;
  productionRequired: boolean;
  description: string;
}

const ENV_VARS: EnvVar[] = [
  { name: "DATABASE_URL",         productionRequired: true,  description: "PostgreSQL connection string" },
  { name: "JWT_SECRET",           productionRequired: true,  description: "Secret for signing access tokens (min 32 chars)" },
  { name: "APP_URL",              productionRequired: true,  description: "Frontend URL used for QR code generation and CORS" },
  { name: "SUPER_ADMIN_EMAIL",    productionRequired: false, description: "Super admin email (defaults to admin@qrsaas.com)" },
  { name: "SUPER_ADMIN_PASSWORD", productionRequired: true,  description: "Super admin password (required in production)" },
  { name: "AWS_ACCESS_KEY_ID",    productionRequired: false, description: "AWS key for S3 uploads (falls back to local storage)" },
  { name: "AWS_SECRET_ACCESS_KEY",productionRequired: false, description: "AWS secret for S3 uploads" },
  { name: "S3_BUCKET",            productionRequired: false, description: "S3 bucket name" },
  { name: "REDIS_URL",            productionRequired: false, description: "Redis URL for Socket.io adapter" },
];

export function validateEnv(): void {
  const isProd = process.env.NODE_ENV === "production";
  const isTest = process.env.NODE_ENV === "test";

  // Skip validation entirely in test mode
  if (isTest) return;

  const missing: string[] = [];
  const optional: string[] = [];

  for (const v of ENV_VARS) {
    const value = process.env[v.name];
    const required = isProd && v.productionRequired;

    if (!value && required) {
      missing.push(`  ✗ ${v.name} — ${v.description}`);
    } else if (!value) {
      optional.push(`  ○ ${v.name} not set — ${v.description}`);
    }
  }

  // JWT_SECRET length check (only if it's set)
  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret && jwtSecret.length < 32) {
    const msg = `JWT_SECRET must be at least 32 characters (got ${jwtSecret.length})`;
    if (isProd) {
      missing.push(`  ✗ ${msg}`);
    } else {
      console.warn(`\n⚠️  ${msg}\n`);
    }
  }

  // In development: just log warnings, don't exit
  if (!isProd) {
    if (optional.length > 0) {
      console.warn("\n⚠️  Optional environment variables not set:");
      optional.forEach((w) => console.warn(w));
      console.warn("");
    }
    if (missing.length > 0) {
      // In dev, 'required in production' vars are just warnings too
      console.warn("\n⚠️  Missing required environment variables:");
      missing.forEach((m) => console.warn(m));
      console.warn("  Check your .env file. Copy .env.example as a starting point.\n");
    }
    return; // Never exit in dev
  }

  // In production: exit on any missing required variable
  if (missing.length > 0) {
    console.error("\n❌ Missing required environment variables:");
    missing.forEach((e) => console.error(e));
    console.error("\nCheck your .env file. Copy .env.production.example as a starting point.\n");
    process.exit(1);
  }
}
