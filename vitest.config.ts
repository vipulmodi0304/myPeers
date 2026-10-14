import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // API tests share one Postgres database, so run files one at a time.
    fileParallelism: false,
    testTimeout: 15_000,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgresql://mypeers:mypeers@localhost:5432/mypeers_test",
    },
  },
});
