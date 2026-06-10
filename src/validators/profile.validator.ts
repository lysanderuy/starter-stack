import { z } from "zod";

/**
 * Example validator. One file per resource. Zod schemas are the single
 * source of truth for input shapes — infer TS types from them.
 */
export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
