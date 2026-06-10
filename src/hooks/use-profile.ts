"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { Profile } from "@/db/schema";
import { api } from "@/lib/api/client";
import type { UpdateProfileInput } from "@/validators/profile.validator";

/**
 * Example server-state hooks. Components never call the api client directly —
 * they go through hooks like these, so caching and invalidation stay in one place.
 */

export const profileKeys = {
  me: ["profile", "me"] as const,
};

export function useProfile() {
  return useQuery({
    queryKey: profileKeys.me,
    queryFn: () => api.get<Profile>("/api/profile"),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateProfileInput) => api.patch<Profile>("/api/profile", input),
    onSuccess: (profile) => {
      queryClient.setQueryData(profileKeys.me, profile);
    },
  });
}
