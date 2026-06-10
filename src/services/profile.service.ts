import { eq } from "drizzle-orm";

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
};
