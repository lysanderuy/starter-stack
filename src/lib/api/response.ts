import { NextResponse } from "next/server";
import { ZodError } from "zod";

import type { ApiResponse } from "@/types/api";

/** Server-side helpers for Route Handlers (src/app/api/**). */

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json<ApiResponse<T>>({ success: true, data }, { status });
}

export function apiError(error: string, status = 400) {
  return NextResponse.json<ApiResponse<never>>({ success: false, error }, { status });
}

/** Catch-all for route handler try/catch blocks. */
export function handleApiError(error: unknown) {
  if (error instanceof ZodError) {
    const message = error.issues
      .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
      .join("; ");
    return apiError(message, 422);
  }

  console.error("[api]", error);
  return apiError("Internal server error", 500);
}
