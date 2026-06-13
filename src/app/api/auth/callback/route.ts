import { NextResponse } from "next/server";

import { emailService } from "@/services/email.service";
import { profileService } from "@/services/profile.service";
import { createClient } from "@/lib/supabase/server";

/**
 * Auth callback — target of email confirmation links and OAuth redirects.
 * Exchanges the one-time code for a session cookie.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/dashboard";
  // Only allow same-origin relative paths — reject protocol-relative (//evil)
  // and absolute URLs so the redirect target can't be attacker-controlled.
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (data.user) {
        await sendWelcomeOnce(data.user.id, data.user.email, origin);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=Could not authenticate`);
}

/**
 * First-confirmation welcome email. This callback also fires for OAuth and
 * recovery, so we gate on an atomic claim to send exactly once. Email is
 * best-effort: a Resend failure releases the claim and never blocks login.
 */
async function sendWelcomeOnce(userId: string, email: string | undefined, origin: string) {
  if (!email) return;

  const claim = await profileService.claimWelcomeEmail(userId);
  if (!claim) return;

  try {
    await emailService.sendWelcome({
      to: email,
      name: claim.displayName ?? email,
      dashboardUrl: `${origin}/dashboard`,
    });
  } catch (err) {
    await profileService.releaseWelcomeClaim(userId, claim.claimedAt);
    // Minimum bar — wire this to your logger/alerting in production so silent
    // welcome-email failures are observable.
    console.error("Welcome email failed:", err);
  }
}
