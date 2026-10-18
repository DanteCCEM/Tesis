import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/integration/**/*.test.js"],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
