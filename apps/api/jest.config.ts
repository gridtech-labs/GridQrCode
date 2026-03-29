import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/__tests__"],
  testMatch: ["**/*.test.ts"],
  setupFiles: ["<rootDir>/__tests__/setup.ts"],
  coverageDirectory: "coverage",
  collectCoverageFrom: ["src/**/*.ts", "!src/db/migrate.ts", "!src/index.ts"],
};

export default config;
