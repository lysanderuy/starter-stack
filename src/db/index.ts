import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/lib/env";

import * as schema from "./schema";

// Cache the connection across hot reloads in development to avoid
// exhausting the Supabase connection pool.
const globalForDb = globalThis as unknown as { pgClient?: ReturnType<typeof postgres> };

// prepare: false is required when connecting through the Supabase
// transaction pooler (port 6543), which does not support prepared statements.
const client = globalForDb.pgClient ?? postgres(env.DATABASE_URL, { prepare: false });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgClient = client;
}

export const db = drizzle(client, { schema });
