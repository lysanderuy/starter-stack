import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "./reset-password-form";

/**
 * User arrives here from the recovery email link with a session already
 * established by /api/auth/callback. The proxy redirects unauthenticated
 * requests, but we re-check here too — defense in depth (the proxy alone can
 * be bypassed by direct navigation).
 */
export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <ResetPasswordForm />;
}
