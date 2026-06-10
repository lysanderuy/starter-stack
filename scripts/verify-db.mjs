import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });
config({ path: ".env" });

/**
 * RLS guardrail: fails (exit 1) if any table in the public schema has
 * Row Level Security disabled. Without RLS, a table is readable via
 * Supabase's auto-generated REST API (/rest/v1) with the anon key —
 * completely outside the app's API layer. Run after every migration.
 */
const sql = postgres(process.env.DIRECT_URL ?? process.env.DATABASE_URL);

const tables = await sql`
  select c.relname as name, c.relrowsecurity as rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
  order by c.relname
`;

await sql.end();

if (tables.length === 0) {
  console.log("No tables in public schema — nothing to check.");
  process.exit(0);
}

const insecure = tables.filter((t) => !t.rls_enabled);

for (const t of tables) {
  console.log(t.rls_enabled ? `  ok    ${t.name}` : `  FAIL  ${t.name} — RLS disabled`);
}

if (insecure.length > 0) {
  console.error(
    `\n${insecure.length} table(s) exposed via /rest/v1 with the anon key.` +
      `\nFix in a migration:\n` +
      insecure.map((t) => `  ALTER TABLE "${t.name}" ENABLE ROW LEVEL SECURITY;`).join("\n"),
  );
  process.exit(1);
}

console.log(`\nAll ${tables.length} public table(s) have RLS enabled.`);
