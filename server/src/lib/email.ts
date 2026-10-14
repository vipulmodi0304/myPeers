import type { Config } from "../config.js";
import { logger } from "../logger.js";

export type Mailer = {
  send(to: string, subject: string, text: string): Promise<void>;
};

/**
 * Sends email through an HTTP API (Brevo or Resend). We use HTTP instead of
 * SMTP because Railway blocks outbound SMTP ports on most plans.
 * In "log" mode (local development) the email is printed to the server log.
 */
export function createMailer(config: Config): Mailer {
  return {
    async send(to, subject, text) {
      if (config.EMAIL_PROVIDER === "log") {
        logger.info({ to, subject }, `\n----- EMAIL (log mode) -----\n${text}\n----------------------------`);
        return;
      }

      let response: Response;
      if (config.EMAIL_PROVIDER === "brevo") {
        response = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "api-key": config.EMAIL_API_KEY!, "content-type": "application/json" },
          body: JSON.stringify({
            sender: { email: config.EMAIL_FROM, name: config.EMAIL_FROM_NAME },
            to: [{ email: to }],
            subject,
            textContent: text,
          }),
        });
      } else {
        response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { authorization: `Bearer ${config.EMAIL_API_KEY}`, "content-type": "application/json" },
          body: JSON.stringify({ from: `${config.EMAIL_FROM_NAME} <${config.EMAIL_FROM}>`, to, subject, text }),
        });
      }
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        logger.error({ status: response.status, detail }, "Email provider rejected the message");
        throw new Error("Could not send email");
      }
    },
  };
}

export function codeEmail(kind: "verify" | "reset", code: string) {
  if (kind === "verify") {
    return {
      subject: `${code} is your myPeers code`,
      text: `Welcome to myPeers!\n\nYour verification code is: ${code}\n\nIt expires in 15 minutes. If you didn't sign up, you can ignore this email.`,
    };
  }
  return {
    subject: `${code} is your myPeers password reset code`,
    text: `Someone asked to reset your myPeers password.\n\nYour reset code is: ${code}\n\nIt expires in 15 minutes. If this wasn't you, ignore this email and your password stays the same.`,
  };
}
