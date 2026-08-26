import { Resend } from "resend";

// Master PRD §3/§6: Resend for deadline reminders + cold-email sending.
// EMAIL_FROM defaults to Resend's shared onboarding domain, which works
// with no setup — override once a verified sending domain exists
// (06-Setup-Guide.md §5).
const DEFAULT_FROM = "Momentum <onboarding@resend.dev>";

let client: Resend | null = null;
function getClient(): Resend {
  if (!client) client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

export type SendEmailResult = { success: true } | { success: false; error: string };

export async function sendEmail(params: { to: string; subject: string; html: string }): Promise<SendEmailResult> {
  try {
    const { error } = await getClient().emails.send({
      from: process.env.EMAIL_FROM || DEFAULT_FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
