import { NextResponse } from "next/server";
import { openApiDocument } from "@/lib/api/openapi";

// Deliberate exception to the ApiResponse<T> envelope rule: this is a spec
// endpoint consumed by external tooling (Scalar, Postman, codegen), not app data.
export async function GET() {
  return NextResponse.json(openApiDocument);
}
