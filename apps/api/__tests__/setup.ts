import "dotenv/config";

// Use a test database if available, otherwise fall back to default
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? "postgresql://qrsaas:secret@localhost:5432/qrsaas_test";

process.env.JWT_SECRET = "test_jwt_secret_for_unit_tests_only";
process.env.REFRESH_TOKEN_SECRET = "test_refresh_secret_for_unit_tests";
process.env.NODE_ENV = "test";
process.env.SUPER_ADMIN_EMAIL = "admin@qrsaas.com";
process.env.SUPER_ADMIN_PASSWORD = "Admin1234!";
