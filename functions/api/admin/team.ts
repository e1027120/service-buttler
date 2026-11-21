import { assertChurchRole, authenticate, type MemberRole } from '../../../server/auth';
import { type Env, errorResponse, HttpError, json, readJson } from '../../../server/db';

export const onRequest: PagesFunction<Env> = async (ctx) => {
  try {
    const { user } = await authenticate(ctx.request, ctx.env);
    const method = ctx.request.method;
    const url = new URL(ctx.request.url);

    // GET /api/admin/team?church_id=...
    if (method === 'GET') {
      const churchId = url.searchParams.get('church_id');
      if (!churchId) throw new HttpError(400, 'church_id is required');

      await assertChurchRole(ctx.env.DB, churchId, user.id);

      const membersRows = await ctx.env.DB
        .prepare(`
          SELECT cm.church_id, cm.user_id, cm.role, cm.created_at,
                 u.email, u.full_name
          FROM church_members cm
          JOIN users u ON u.id = cm.user_id
          WHERE cm.church_id = ?
          ORDER BY cm.role ASC, u.email ASC
        `)
        .bind(churchId)
        .all<{
          church_id: string;
          user_id: string;
          role: MemberRole;
          created_at: string;
          email: string;
          full_name: string | null;
        }>();

      const invitationsRows = await ctx.env.DB
        .prepare('SELECT * FROM church_invitations WHERE church_id = ? ORDER BY created_at DESC')
        .bind(churchId)
        .all<Record<string, unknown>>();

      return json({
        members: membersRows.results,
        invitations: invitationsRows.results,
      });
    }

    // POST /api/admin/team - Invite member
    if (method === 'POST') {
      const body = await readJson<{
        church_id: string;
        church_name?: string;
        email: string;
        role?: MemberRole;
        inviter_name?: string;
      }>(ctx.request);

      if (!body.church_id || !body.email) {
        throw new HttpError(400, 'church_id and email are required');
      }

      const role = body.role || 'editor';
      const email = body.email.trim().toLowerCase();

      // Only owner or admin can invite; only owner can invite owner
      if (role === 'owner') {
        await assertChurchRole(ctx.env.DB, body.church_id, user.id, ['owner']);
      } else {
        await assertChurchRole(ctx.env.DB, body.church_id, user.id, ['owner', 'admin']);
      }

      // Check if user already exists
      const targetUser = await ctx.env.DB
        .prepare('SELECT id, email, full_name FROM users WHERE email = ?')
        .bind(email)
        .first<{ id: string; email: string; full_name: string | null }>();

      const now = new Date().toISOString();
      let statusResult = 'invited';

      if (targetUser) {
        await ctx.env.DB
          .prepare(`
            INSERT INTO church_members (church_id, user_id, role, created_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT (church_id, user_id) DO UPDATE SET role = excluded.role
          `)
          .bind(body.church_id, targetUser.id, role, now)
          .run();
        statusResult = 'added';
      } else {
        const invId = crypto.randomUUID();
        await ctx.env.DB
          .prepare(`
            INSERT INTO church_invitations (id, church_id, email, role, invited_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT (church_id, email) DO UPDATE SET role = excluded.role
          `)
          .bind(invId, body.church_id, email, role, user.id, now)
          .run();
      }

      // Send email via Resend if configured
      const resendApiKey = ctx.env.RESEND_API_KEY || ctx.env.VITE_RESEND_API_KEY;
      if (resendApiKey) {
        try {
          const origin = new URL(ctx.request.url).origin;
          const churchName = body.church_name || 'Church Team';
          const loginUrl = `${origin}/login?invited_to=${encodeURIComponent(churchName)}`;
          const fromEmail = ctx.env.RESEND_FROM_EMAIL || 'Service Buttler <onboarding@resend.dev>';
          const roleLabel = role === 'admin' ? 'an Administrator' : role === 'owner' ? 'an Owner' : 'an Editor';
          const inviterText = body.inviter_name ? `${body.inviter_name} has invited you` : `You have been invited`;

          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: fromEmail,
              to: [email],
              subject: `Join the ${churchName} team on Service Buttler`,
              html: `
                <div style="font-family: sans-serif; padding: 24px; max-width: 500px; margin: 0 auto;">
                  <h2 style="color: #4f46e5;">Service Buttler</h2>
                  <h3>Join the ${churchName} team</h3>
                  <p>${inviterText} to collaborate on <strong>${churchName}</strong> as <strong>${roleLabel}</strong>.</p>
                  <p style="margin: 28px 0;">
                    <a href="${loginUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">
                      Accept Invitation & Sign In
                    </a>
                  </p>
                </div>
              `,
            }),
          });
        } catch (e) {
          console.warn('Failed to send invite email via Resend:', e);
        }
      }

      return json({ status: statusResult }, { status: 201 });
    }

    // PATCH /api/admin/team - Update member role
    if (method === 'PATCH') {
      const body = await readJson<{
        church_id: string;
        user_id: string;
        role: MemberRole;
      }>(ctx.request);

      if (!body.church_id || !body.user_id || !body.role) {
        throw new HttpError(400, 'church_id, user_id, and role are required');
      }

      if (body.role === 'owner') {
        await assertChurchRole(ctx.env.DB, body.church_id, user.id, ['owner']);
      } else {
        await assertChurchRole(ctx.env.DB, body.church_id, user.id, ['owner', 'admin']);
      }

      await ctx.env.DB
        .prepare('UPDATE church_members SET role = ? WHERE church_id = ? AND user_id = ?')
        .bind(body.role, body.church_id, body.user_id)
        .run();

      return json({ ok: true });
    }

    // DELETE /api/admin/team?church_id=...&user_id=... or &invitation_id=...
    if (method === 'DELETE') {
      const churchId = url.searchParams.get('church_id');
      const userId = url.searchParams.get('user_id');
      const invitationId = url.searchParams.get('invitation_id');

      if (!churchId) throw new HttpError(400, 'church_id is required');

      if (invitationId) {
        await assertChurchRole(ctx.env.DB, churchId, user.id, ['owner', 'admin']);
        await ctx.env.DB
          .prepare('DELETE FROM church_invitations WHERE id = ? AND church_id = ?')
          .bind(invitationId, churchId)
          .run();
        return json({ ok: true });
      }

      if (userId) {
        // Users can remove themselves, or admins/owners can remove other members
        if (userId !== user.id) {
          await assertChurchRole(ctx.env.DB, churchId, user.id, ['owner', 'admin']);
        }

        // Prevent deleting the last owner
        const targetMember = await ctx.env.DB
          .prepare('SELECT role FROM church_members WHERE church_id = ? AND user_id = ?')
          .bind(churchId, userId)
          .first<{ role: MemberRole }>();

        if (targetMember?.role === 'owner') {
          const ownerCount = await ctx.env.DB
            .prepare("SELECT COUNT(*) as count FROM church_members WHERE church_id = ? AND role = 'owner'")
            .bind(churchId)
            .first<{ count: number }>();

          if ((ownerCount?.count ?? 0) <= 1) {
            throw new HttpError(400, 'Cannot remove the last owner of a church');
          }
        }

        await ctx.env.DB
          .prepare('DELETE FROM church_members WHERE church_id = ? AND user_id = ?')
          .bind(churchId, userId)
          .run();

        return json({ ok: true });
      }

      throw new HttpError(400, 'user_id or invitation_id is required');
    }

    throw new HttpError(405, 'Method not allowed');
  } catch (err) {
    return errorResponse(err);
  }
};
