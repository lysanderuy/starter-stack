import "server-only";

import { Resend } from "resend";

import { env } from "@/lib/env";
import { WelcomeEmail } from "@/emails/welcome-email";

/**
 * Transactional email. Owns the Resend client and all send logic — callers
 * (other services, route handlers) pass plain inputs. Never touches
 * Request/Response. Throws on send failure so handleApiError can map it.
 *
 * NOTE: this covers app-sent email only. Auth emails (confirm / reset /
 * magic-link) are sent by Supabase Auth over SMTP and are configured in the
 * Supabase dashboard, not here.
 */

// Lazy so a fresh clone / CI without RESEND_API_KEY can still `next build`
// (mirrors the lazy env proxy). First real send fails fast with a clear error.
let client: Resend | null = null;
function resend(): { client: Resend; from: string } {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
    throw new Error(
      "Email is not configured: set RESEND_API_KEY and RESEND_FROM_EMAIL (see .env.example).",
    );
  }
  client ??= new Resend(env.RESEND_API_KEY);
  return { client, from: env.RESEND_FROM_EMAIL };
}

export interface SendWelcomeEmailInput {
  to: string;
  name: string;
  dashboardUrl: string;
}

export const emailService = {
  async sendWelcome({ to, name, dashboardUrl }: SendWelcomeEmailInput): Promise<string> {
    const { client, from } = resend();
    const { data, error } = await client.emails.send({
      from,
      to,
      subject: `Welcome, ${name}`,
      react: WelcomeEmail({ name, dashboardUrl }),
    });

    if (error) {
      throw new Error(`Resend send failed: ${error.message}`);
    }

    return data.id;
  },
};
