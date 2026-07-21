import { describe, expect, it } from "vitest";

import { checkRateLimit } from "./rate-limit";

// No UPSTASH_REDIS_REST_URL/TOKEN in the test environment — this exercises
// the real "unconfigured" code path (no mocking involved), which is the
// property that matters most: a fresh clone must never fail-closed.
describe("checkRateLimit (Upstash unconfigured)", () => {
  it("allows requests on the default limiter", async () => {
    await expect(checkRateLimit("/api/profile", "1.2.3.4")).resolves.toEqual({ success: true });
  });

  it("allows requests on an overridden route", async () => {
    await expect(checkRateLimit("/api/auth/callback", "1.2.3.4")).resolves.toEqual({
      success: true,
    });
  });
});
