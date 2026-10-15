import nodemailer, { type Transporter } from "nodemailer";

// Generic SMTP via Nodemailer — works with any provider (Gmail with an App
// Password, a custom domain's SMTP relay, Outlook, Zoho, etc.), configured
// entirely through env vars rather than a hardcoded provider. Switched from
// Resend because its sandbox sender refuses delivery to anyone but its own
// fixed test address without a verified domain — SMTP has no such
// restriction once the account itself is real.
//
// Required env vars: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM.
// SMTP_SECURE ("true"/"false") controls implicit TLS — true for port 465,
// false (STARTTLS) for port 587, which is the common case (e.g. Gmail).

let transporter: Transporter | null = null;
function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

export type SendEmailResult = { success: true } | { success: false; error: string };

export type EmailAttachment = { filename: string; path: string };

export async function sendEmail(params: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
}): Promise<SendEmailResult> {
  const from = process.env.EMAIL_FROM;
  if (!from || !process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return { success: false, error: "SMTP_HOST/SMTP_USER/SMTP_PASS/EMAIL_FROM not configured" };
  }

  // Reply-To and List-Unsubscribe are small but real deliverability
  // signals — their absence is itself a mild spam indicator under Gmail/
  // Yahoo's bulk-sender guidelines, which apply even at low volume. Not
  // a substitute for proper domain authentication (SPF/DKIM/DMARC), which
  // a bare @gmail.com address can't have — this only mitigates, not fixes,
  // a personal Gmail SMTP account's elevated baseline spam risk for
  // automated-looking outreach.
  const fromAddressMatch = from.match(/<([^>]+)>/);
  const fromAddress = fromAddressMatch ? fromAddressMatch[1] : from;

  try {
    await getTransporter().sendMail({
      from,
      to: params.to,
      replyTo: fromAddress,
      subject: params.subject,
      html: params.html,
      text: params.text,
      attachments: params.attachments,
      headers: {
        "List-Unsubscribe": `<mailto:${fromAddress}?subject=unsubscribe>`,
      },
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
