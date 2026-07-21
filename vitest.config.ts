import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    // env.ts validates the whole schema on first access — supply dummy
    // values for required vars so tests can exercise optional-var code
    // paths (e.g. rate-limit.ts) without needing real credentials.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    },
  },
});
