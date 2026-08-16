import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["apps/*/src/**/*.test.ts", "packages/*/src/**/*.test.ts"],
    environment: "node",
    // Multiple test files write to the same shared, real Postgres when
    // DATABASE_URL is set (packages/database, packages/audit, apps/api's
    // onboarding engine) - some of that state is deliberately global and
    // order-sensitive (audit_log_entries is a single hash chain across the
    // whole table, by design). Running files in parallel let one file's
    // writes land between another file's "sequential" calls, breaking
    // chain-order assumptions the tests make even though the actual
    // chain-hash integrity itself stayed correct. The suite is small
    // (well under a second sequentially), so serializing file execution
    // costs nothing meaningful and removes an entire class of flaky
    // failures.
    fileParallelism: false,
  },
});
