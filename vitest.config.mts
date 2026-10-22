import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    environment: "node",
    // Test integration menembak Supabase host (auth + RLS roundtrip); latensi
    // jaringan membuat cap default 5 detik sering gugur di cold-start.
    testTimeout: 20_000,
  },
});
