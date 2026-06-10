import { z } from "zod";

/**
 * Server-side environment validation. Validated lazily on first access —
 * `next build` imports route modules while collecting page data, and a
 * fresh clone / CI runner has no env vars; eager parsing would fail the
 * build. At runtime the first access still fails fast with a clear error.
 * Do NOT import this from client components — use process.env.NEXT_PUBLIC_*
 * directly there (inlined at build time).
 */
const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
});

type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export const env: Env = new Proxy({} as Env, {
  get(_target, key: string) {
    cached ??= envSchema.parse({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      DATABASE_URL: process.env.DATABASE_URL,
    });
    return cached[key as keyof Env];
  },
});
