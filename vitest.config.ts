import "dotenv/config";
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    setupFiles: [],
    // Integration tests share a single Postgres test database via testDb/
    // resetDatabase() (tests/integration/setup.ts). Running test files in
    // parallel lets one file's beforeEach(resetDatabase) wipe rows another
    // file's test just inserted (or vice versa), so force sequential file
    // execution to keep the shared DB deterministic across all suites.
    fileParallelism: false,
  },
});
