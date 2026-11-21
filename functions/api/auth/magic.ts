import { hashToken } from '../../../server/auth';
import { type Env, errorResponse, HttpError, json, readJson } from '../../../server/db';

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const body = await readJson<{ email?: string }>(ctx.request);
    const email = body.email?.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      throw new HttpError(400, 'Valid email is required');
    }

    const rawToken = crypto.randomUUID() + '-' + crypto.randomUUID();
    const tokenHash = await hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins

    await ctx.env.DB
      .prepare('INSERT INTO magic_links (id, email, token_hash, expires_at) VALUES (?, ?, ?, ?)')
      .bind(tokenHash, email, tokenHash, expiresAt)
      .run();

    const origin = new URL(ctx.request.url).origin;
    const magicUrl = `${origin}/login?magic_token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(email)}`;

    const resendApiKey = ctx.env.RESEND_API_KEY || ctx.env.VITE_RESEND_API_KEY;
    if (resendApiKey) {
      const fromEmail = ctx.env.RESEND_FROM_EMAIL || 'Service Buttler <onboarding@resend.dev>';
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [email],
          subject: 'Your sign-in link for Service Buttler',
          html: `
            <div style="font-family: sans-serif; padding: 24px; max-width: 480px; margin: 0 auto;">
              <h2 style="color: #4f46e5;">Service Buttler</h2>
              <p>Click the button below to sign in to your Service Buttler dashboard:</p>
              <p style="margin: 28px 0;">
                <a href="${magicUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">
                  Sign In to Service Buttler
                </a>
              </p>
              <p style="color: #64748b; font-size: 13px;">This link will expire in 15 minutes.</p>
            </div>
          `,
        }),
      });
    }

    return json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
};
