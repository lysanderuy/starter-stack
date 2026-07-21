import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { NextRequest } from "next/server";

import { env } from "@/lib/env";

/**
 * Rate limiting via Upstash Redis (REST-based, so it works from Edge
 * middleware — see src/proxy.ts). Optional and lazy: without
 * UPSTASH_REDIS_REST_URL/TOKEN set, checkRateLimit() always allows the
 * request, so a fresh clone still runs unthrottled until Upstash is
 * configured (see .env.example). Do NOT import this from client components.
 */

let redis: Redis | null = null;
function getRedis(): Redis | null {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) return null;
  redis ??= new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN });
  return redis;
}

type Window = `${number} ${"ms" | "s" | "m" | "h" | "d"}`;

const limiters = new Map<string, Ratelimit>();
function getLimiter(name: string, requests: number, window: Window): Ratelimit | null {
  const client = getRedis();
  if (!client) return null;

  let limiter = limiters.get(name);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: client,
      limiter: Ratelimit.slidingWindow(requests, window),
      prefix: `ratelimit:${name}`,
    });
    limiters.set(name, limiter);
  }
  return limiter;
}

const DEFAULT_LIMIT = { requests: 60, window: "1 m" as Window };

// Path-prefix overrides, checked in order — first match wins, else
// DEFAULT_LIMIT applies. Extend this list per route as new abuse-prone
// endpoints show up (mirrors the protectedPrefixes pattern in
// src/lib/supabase/proxy.ts).
const overrides: Array<{ prefix: string; name: string; requests: number; window: Window }> = [
  { prefix: "/api/auth", name: "auth", requests: 10, window: "1 m" },
];

export interface RateLimitResult {
  success: boolean;
  reset?: number;
}

export async function checkRateLimit(pathname: string, identifier: string): Promise<RateLimitResult> {
  const match = overrides.find((o) => pathname.startsWith(o.prefix));
  const { name, requests, window } = match ?? { name: "default", ...DEFAULT_LIMIT };

  const limiter = getLimiter(name, requests, window);
  if (!limiter) return { success: true };

  const { success, reset } = await limiter.limit(identifier);
  return { success, reset };
}

/**
 * IP-based identifier. Vercel sets x-forwarded-for; local dev has neither
 * header, so all local requests share one bucket — fine for local testing.
 */
export function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
