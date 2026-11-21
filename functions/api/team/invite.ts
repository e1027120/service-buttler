import { assertChurchRole, authenticate } from '../../../server/auth';
import { type Env, errorResponse, HttpError, json, readJson } from '../../../server/db';

/**
 * POST /api/team/invite
 * Authenticated endpoint for inviting a member to a church team and dispatching
 * an invitation email via Resend if RESEND_API_KEY is configured.
 */
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const { user } = await authenticate(ctx.request, ctx.env);
    const body = await readJson<{
      church_id?: string;
      church_name?: string;
      email?: string;
      role?: string;
      inviter_name?: string;
    }>(ctx.request);

    const churchId = body.church_id?.trim();
    const churchName = body.church_name?.trim() || 'Church Team';
    const email = body.email?.trim().toLowerCase();
    const role = (body.role?.trim() || 'editor') as 'owner' | 'admin' | 'editor';
    const inviterName = body.inviter_name?.trim();

    if (!churchId || !email) {
      throw new HttpError(400, 'Missing church_id or email');
    }

    if (role === 'owner') {
      await assertChurchRole(ctx.env.DB, churchId, user.id, ['owner']);
    } else {
      await assertChurchRole(ctx.env.DB, churchId, user.id, ['owner', 'admin']);
    }

    const targetUser = await ctx.env.DB
      .prepare('SELECT id, email FROM users WHERE email = ?')
      .bind(email)
      .first<{ id: string; email: string }>();

    const now = new Date().toISOString();
    let result = 'invited';

    if (targetUser) {
      await ctx.env.DB
        .prepare(`
          INSERT INTO church_members (church_id, user_id, role, created_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT (church_id, user_id) DO UPDATE SET role = excluded.role
        `)
        .bind(churchId, targetUser.id, role, now)
        .run();
      result = 'added';
    } else {
      const invId = crypto.randomUUID();
      await ctx.env.DB
        .prepare(`
          INSERT INTO church_invitations (id, church_id, email, role, invited_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT (church_id, email) DO UPDATE SET role = excluded.role
        `)
        .bind(invId, churchId, email, role, user.id, now)
        .run();
    }

    const resendApiKey = ctx.env.RESEND_API_KEY || ctx.env.VITE_RESEND_API_KEY;
    if (resendApiKey) {
      try {
        const origin = new URL(ctx.request.url).origin;
        const loginUrl = `${origin}/login?invited_to=${encodeURIComponent(churchName)}`;
        const fromEmail = ctx.env.RESEND_FROM_EMAIL || 'Service Buttler <onboarding@resend.dev>';
        const roleLabel = role === 'admin' ? 'an Administrator' : role === 'owner' ? 'an Owner' : 'an Editor';
        const inviterText = inviterName ? `${inviterName} has invited you` : `You have been invited`;

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [email],
            subject: `Join the ${churchName} team`,
            html: `
              <div style="font-family: sans-serif; padding: 24px; max-width: 500px;">
                <h2 style="color: #4f46e5;">Service Buttler</h2>
                <p>${inviterText} to join <strong>${churchName}</strong> as <strong>${roleLabel}</strong>.</p>
                <p style="margin: 24px 0;">
                  <a href="${loginUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">
                    Accept Invitation
                  </a>
                </p>
              </div>
            `,
          }),
        });
      } catch (e) {
        console.warn('Failed to dispatch invite email:', e);
      }
    }

    return json({ ok: true, result });
  } catch (err) {
    return errorResponse(err);
  }
};
