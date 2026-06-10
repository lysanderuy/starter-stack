/** Standard envelope returned by every API route handler. */
export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };
