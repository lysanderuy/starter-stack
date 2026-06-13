/**
 * Streaming fallback shown while the server component fetches. Replace the
 * skeleton with one matching your page; this demonstrates the convention.
 */
export default function DashboardLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl p-8">
      <div className="h-8 w-40 animate-pulse rounded-md bg-foreground/10" />
      <div className="mt-6 h-4 w-64 animate-pulse rounded-md bg-foreground/10" />
    </main>
  );
}
