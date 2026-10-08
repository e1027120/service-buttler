import { type Env, errorResponse, HttpError, json, rpc } from '../../../server/supabase';

/**
 * POST /api/team/invite
 * Authenticated endpoint for inviting a member to a church team and dispatching
 * an invitation email via Resend if RESEND_API_KEY is configured.
 */
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const authHeader = ctx.request.headers.get('Authorization');
    if (!authHeader) {
      throw new HttpError(401, 'Unauthorized: Missing authorization header');
    }

    const body = (await ctx.request.json().catch(() => ({}))) as {
      church_id?: string;
      church_name?: string;
      email?: string;
      role?: string;
      inviter_name?: string;
    };

    const churchId = body.church_id?.trim();
    const churchName = body.church_name?.trim() || 'Church Team';
    const email = body.email?.trim().toLowerCase();
    const role = body.role?.trim() || 'editor';
    const inviterName = body.inviter_name?.trim();

    if (!churchId || !email) {
      throw new HttpError(400, 'Missing church_id or email');
    }

    // Call Supabase RPC under the caller's JWT token to enforce permissions (only owner/admin can invite)
    const result = await rpc<string>(
      ctx.env,
      'invite_member',
      {
        p_church: churchId,
        p_email: email,
        p_role: role,
      },
      authHeader
    );

    let emailSent = false;
    let emailError: string | null = null;

    const resendApiKey = ctx.env.RESEND_API_KEY || (ctx.env as Record<string, string>)?.VITE_RESEND_API_KEY;

    if (resendApiKey) {
      try {
        const origin = new URL(ctx.request.url).origin;
        const loginUrl = `${origin}/login?invited_to=${encodeURIComponent(churchName)}`;
        const fromEmail = ctx.env.RESEND_FROM_EMAIL || 'Service Buttler <onboarding@resend.dev>';

        const roleLabel = role === 'admin' ? 'an Administrator' : role === 'owner' ? 'an Owner' : 'an Editor';
        const inviterText = inviterName ? `${inviterName} has invited you` : `You have been invited`;

        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Invitation to ${churchName}</title>
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; padding: 24px; margin: 0;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; max-width: 520px; text-align: left; padding: 36px 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
                      <div style="font-size: 20px; font-weight: 800; color: #4f46e5; margin-bottom: 24px; display: flex; align-items: center; gap: 8px;">
                        <span>Service Buttler</span>
                      </div>
                      <h1 style="font-size: 22px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 12px; line-height: 1.3;">
                        Join the ${churchName} team
                      </h1>
                      <p style="font-size: 15px; line-height: 1.6; color: #475569; margin: 16px 0;">
                        ${inviterText} to collaborate on <strong>${churchName}</strong> on Service Buttler as <span style="display: inline-block; background-color: #eef2ff; color: #4f46e5; padding: 3px 10px; border-radius: 9999px; font-size: 13px; font-weight: 600;">${roleLabel}</span>.
                      </p>
                      <p style="font-size: 14px; line-height: 1.6; color: #64748b; margin: 16px 0;">
                        With Service Buttler, you can coordinate Sunday live action cards, sermon notes, announcement slides, and congregation cues in real time.
                      </p>
                      <div style="text-align: center; margin: 32px 0 24px;">
                        <a href="${loginUrl}" style="display: inline-block; background-color: #4f46e5; color: #ffffff !important; text-decoration: none; padding: 13px 32px; border-radius: 10px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);">
                          Accept Invitation & Sign In
                        </a>
                      </div>
                      <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 28px 0 20px;" />
                      <p style="font-size: 12px; line-height: 1.5; color: #94a3b8; margin: 0;">
                        Sign in using <strong>${email}</strong>. If you do not have an account yet, one will be created when you sign in with this email.
                      </p>
                    </div>
                    <div style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 24px;">
                      Service Buttler · The modern live service companion for churches
                    </div>
                  </td>
                </tr>
              </table>
            </body>
          </html>
        `;

        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [email],
            subject: `You've been invited to join ${churchName} on Service Buttler`,
            html,
          }),
        });

        if (resendRes.ok) {
          emailSent = true;
        } else {
          const errData = await resendRes.text();
          emailError = `Resend HTTP ${resendRes.status}: ${errData}`;
          console.error('Failed to send email via Resend:', emailError);
        }
      } catch (e) {
        emailError = e instanceof Error ? e.message : 'Unknown email sending error';
        console.error('Error dispatching email:', e);
      }
    }

    return json({
      status: result, // 'added' or 'invited'
      emailSent,
      hasResendConfigured: Boolean(resendApiKey),
      emailError,
    });
  } catch (err) {
    return errorResponse(err);
  }
};
