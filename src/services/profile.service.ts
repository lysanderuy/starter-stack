import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { profiles, type Profile } from "@/db/schema";
import type { UpdateProfileInput } from "@/validators/profile.validator";

/**
 * Example service. All business logic and DB access for a resource lives
 * here — route handlers stay thin (auth, validate, delegate, respond).
 * Services never touch Request/Response objects.
 */
export const profileService = {
  async getById(id: string): Promise<Profile | undefined> {
    return db.query.profiles.findFirst({
      where: eq(profiles.id, id),
    });
  },

  async update(id: string, input: UpdateProfileInput): Promise<Profile | undefined> {
    const [updated] = await db
      .update(profiles)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(profiles.id, id))
      .returning();

    return updated;
  },

  /**
   * Atomically claim the one-time welcome email for this user. Returns the
   * claim (timestamp + displayName) only for the call that flips
   * welcome_email_sent_at from null — concurrent callbacks get null, so the
   * email sends exactly once. On send failure the caller passes the timestamp
   * back to releaseWelcomeClaim() to allow a later retry.
   */
  async claimWelcomeEmail(
    id: string,
  ): Promise<{ claimedAt: Date; displayName: string | null } | null> {
    const claimedAt = new Date();
    const [claimed] = await db
      .update(profiles)
      .set({ welcomeEmailSentAt: claimedAt })
      .where(and(eq(profiles.id, id), isNull(profiles.welcomeEmailSentAt)))
      .returning({ displayName: profiles.displayName });

    return claimed ? { claimedAt, displayName: claimed.displayName } : null;
  },

  /**
   * Revert a claim after a failed send. Guarded on the exact timestamp this
   * request set, so it can never clobber a welcome email a different
   * invocation already sent.
   */
  async releaseWelcomeClaim(id: string, claimedAt: Date): Promise<void> {
    await db
      .update(profiles)
      .set({ welcomeEmailSentAt: null })
      .where(and(eq(profiles.id, id), eq(profiles.welcomeEmailSentAt, claimedAt)));
  },
};
