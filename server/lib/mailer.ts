import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import type { Config } from '../config.js';

// Outgoing email goes through Amazon SES. On EC2 the credentials come from the
// instance's IAM role; nothing secret needs to be in .env. Without EMAIL_FROM (local
// development), messages are printed to the server log instead of being sent.

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  readonly configured: boolean;
  send(mail: Mail): Promise<void>;
}

export function createMailer(config: Config): Mailer {
  const { from, region } = config.email;
  if (!from) {
    return {
      configured: false,
      async send(mail) {
        console.log(`[mail] (not sent: EMAIL_FROM is not set) to=${mail.to} subject="${mail.subject}"\n${mail.text}`);
      },
    };
  }

  const client = new SESv2Client(region ? { region } : {});
  return {
    configured: true,
    async send(mail) {
      await client.send(
        new SendEmailCommand({
          FromEmailAddress: from,
          Destination: { ToAddresses: [mail.to] },
          Content: {
            Simple: {
              Subject: { Data: mail.subject, Charset: 'UTF-8' },
              Body: {
                Text: { Data: mail.text, Charset: 'UTF-8' },
                Html: { Data: mail.html, Charset: 'UTF-8' },
              },
            },
          },
        }),
      );
    },
  };
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

// Simple branded message with one call-to-action link.
export function actionEmail(opts: { to: string; subject: string; greeting: string; body: string; action: string; url: string }): Mail {
  const text = `${opts.greeting}\n\n${opts.body}\n\n${opts.action}: ${opts.url}\n\nIf you did not request this, you can ignore this email.\n\nREVA AICTE IDEA Lab`;
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5">
<p>${escapeHtml(opts.greeting)}</p>
<p>${escapeHtml(opts.body)}</p>
<p><a href="${escapeHtml(opts.url)}" style="display:inline-block;background:#ea580c;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">${escapeHtml(opts.action)}</a></p>
<p style="color:#64748b;font-size:13px">Or open this link: ${escapeHtml(opts.url)}</p>
<p style="color:#64748b;font-size:13px">If you did not request this, you can ignore this email.<br>REVA AICTE IDEA Lab</p>
</body></html>`;
  return { to: opts.to, subject: opts.subject, text, html };
}
