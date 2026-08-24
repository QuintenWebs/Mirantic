const RESEND_API_KEY = process.env.RESEND_API_KEY;
const INVITE_FROM = process.env.INVITE_FROM || "Mirantic <invites@mirantic.com>";
const APP_URL = process.env.APP_URL || "https://app.mirantic.com";

export interface SendResult {
  sent: boolean;
  /** Why it didn't send — surfaced to the admin so a failure is never silent. */
  reason?: string;
  id?: string;
}

/**
 * Send one email through Resend.
 *
 * Never throws: a failure here must not lose an invitation that has already been
 * created in Auth0 and the database. The caller reports `sent` to the admin and
 * still hands back the invite link to pass along by hand.
 */
async function send(to: string, subject: string, html: string, text: string): Promise<SendResult> {
  if (!RESEND_API_KEY) {
    return { sent: false, reason: "RESEND_API_KEY is not set" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ from: INVITE_FROM, to: [to], subject, html, text }),
    });
    if (!res.ok) {
      let detail = `status ${res.status}`;
      try {
        const body = (await res.json()) as { message?: string; name?: string };
        if (body?.message) detail = body.message;
      } catch {
        /* keep the status */
      }
      return { sent: false, reason: detail };
    }
    const body = (await res.json()) as { id?: string };
    return { sent: true, id: body.id };
  } catch (err) {
    return { sent: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string
  );
}

/**
 * Invitation to set a password and sign in. `inviteUrl` is the Auth0
 * password-change ticket produced when the account was created.
 */
export function inviteEmail(name: string, inviteUrl: string): { subject: string; html: string; text: string } {
  const greeting = name?.trim() ? `Hi ${escapeHtml(name.trim())},` : "Hi,";
  const subject = "Your Mirantic login";
  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f5f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1f2933;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f8;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e4e7eb;border-radius:12px;padding:32px;">
            <tr>
              <td style="padding-bottom:24px;">
                <span style="display:inline-block;width:28px;height:28px;line-height:28px;text-align:center;background:#4A6FA5;color:#ffffff;border-radius:6px;font-weight:700;font-size:14px;">M</span>
                <span style="font-size:15px;font-weight:600;margin-left:8px;">Mirantic</span>
              </td>
            </tr>
            <tr>
              <td style="font-size:20px;font-weight:600;padding-bottom:12px;">You've been invited</td>
            </tr>
            <tr>
              <td style="font-size:15px;line-height:1.6;color:#52606d;padding-bottom:24px;">
                ${greeting}<br /><br />
                You can now edit and publish your website content in Mirantic.
                Set your password to get started — the link is valid for a limited time.
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:24px;">
                <a href="${inviteUrl}" style="display:inline-block;background:#4A6FA5;color:#ffffff;text-decoration:none;font-size:15px;font-weight:500;padding:12px 24px;border-radius:8px;">Set your password</a>
              </td>
            </tr>
            <tr>
              <td style="font-size:13px;line-height:1.6;color:#7b8794;border-top:1px solid #e4e7eb;padding-top:20px;">
                Afterwards you can always sign in at
                <a href="${APP_URL}" style="color:#4A6FA5;">${APP_URL.replace(/^https?:\/\//, "")}</a>.<br />
                If you weren't expecting this, you can ignore this email.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  const text = `${name?.trim() ? `Hi ${name.trim()},` : "Hi,"}

You've been invited to Mirantic, where you can edit and publish your website content.

Set your password: ${inviteUrl}

Afterwards you can sign in at ${APP_URL}.
If you weren't expecting this, you can ignore this email.`;
  return { subject, html, text };
}

export async function sendInviteEmail(to: string, name: string, inviteUrl: string): Promise<SendResult> {
  const { subject, html, text } = inviteEmail(name, inviteUrl);
  return send(to, subject, html, text);
}
