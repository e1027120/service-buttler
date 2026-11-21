import { assertChurchRole, authenticate } from '../../../server/auth';
import { type Env, errorResponse, HttpError, json, readJson } from '../../../server/db';

export const onRequest: PagesFunction<Env> = async (ctx) => {
  try {
    const { user } = await authenticate(ctx.request, ctx.env);
    const method = ctx.request.method;

    // GET /api/admin/churches - List user's churches
    if (method === 'GET') {
      const rows = await ctx.env.DB
        .prepare(`
          SELECT c.*, cm.role
          FROM churches c
          JOIN church_members cm ON cm.church_id = c.id
          WHERE cm.user_id = ?
          ORDER BY c.name ASC
        `)
        .bind(user.id)
        .all<{
          id: string;
          slug: string;
          name: string;
          timezone: string;
          logo_url: string | null;
          primary_color: string;
          accent_color: string;
          landing: string;
          role: string;
          created_at: string;
          updated_at: string;
        }>();

      const churches = rows.results.map((c) => ({
        ...c,
        landing: typeof c.landing === 'string' ? JSON.parse(c.landing || '{}') : c.landing || {},
      }));

      return json(churches);
    }

    // POST /api/admin/churches - Create new church
    if (method === 'POST') {
      const body = await readJson<{
        name?: string;
        slug?: string;
        timezone?: string;
        logo_url?: string;
        primary_color?: string;
        accent_color?: string;
        landing?: Record<string, unknown>;
      }>(ctx.request);

      const name = body.name?.trim();
      const slug = body.slug?.trim().toLowerCase();
      if (!name || !slug) {
        throw new HttpError(400, 'Name and slug are required');
      }

      const existing = await ctx.env.DB
        .prepare('SELECT id FROM churches WHERE slug = ?')
        .bind(slug)
        .first();

      if (existing) {
        throw new HttpError(409, 'Church slug already taken');
      }

      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const timezone = body.timezone || 'UTC';
      const primaryColor = body.primary_color || '#4f46e5';
      const accentColor = body.accent_color || '#f59e0b';
      const landingStr = JSON.stringify(body.landing || {});

      await ctx.env.DB
        .prepare(`
          INSERT INTO churches (id, slug, name, timezone, logo_url, primary_color, accent_color, landing, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(id, slug, name, timezone, body.logo_url || null, primaryColor, accentColor, landingStr, user.id, now, now)
        .run();

      // Creator is owner
      await ctx.env.DB
        .prepare('INSERT INTO church_members (church_id, user_id, role, created_at) VALUES (?, ?, ?, ?)')
        .bind(id, user.id, 'owner', now)
        .run();

      const created = {
        id,
        slug,
        name,
        timezone,
        logo_url: body.logo_url || null,
        primary_color: primaryColor,
        accent_color: accentColor,
        landing: body.landing || {},
        role: 'owner',
        created_at: now,
        updated_at: now,
      };

      return json(created, { status: 201 });
    }

    // PATCH /api/admin/churches - Update church
    if (method === 'PATCH') {
      const body = await readJson<{
        id: string;
        name?: string;
        slug?: string;
        timezone?: string;
        logo_url?: string | null;
        primary_color?: string;
        accent_color?: string;
        landing?: Record<string, unknown>;
      }>(ctx.request);

      if (!body.id) {
        throw new HttpError(400, 'Church id is required');
      }

      await assertChurchRole(ctx.env.DB, body.id, user.id, ['owner', 'admin']);

      const current = await ctx.env.DB
        .prepare('SELECT * FROM churches WHERE id = ?')
        .bind(body.id)
        .first<Record<string, unknown>>();

      if (!current) throw new HttpError(404, 'Church not found');

      const name = body.name !== undefined ? body.name.trim() : (current.name as string);
      const slug = body.slug !== undefined ? body.slug.trim().toLowerCase() : (current.slug as string);
      const timezone = body.timezone !== undefined ? body.timezone : (current.timezone as string);
      const logoUrl = body.logo_url !== undefined ? body.logo_url : (current.logo_url as string | null);
      const primaryColor = body.primary_color !== undefined ? body.primary_color : (current.primary_color as string);
      const accentColor = body.accent_color !== undefined ? body.accent_color : (current.accent_color as string);
      const landingStr = body.landing !== undefined ? JSON.stringify(body.landing) : (current.landing as string);
      const now = new Date().toISOString();

      await ctx.env.DB
        .prepare(`
          UPDATE churches
          SET name = ?, slug = ?, timezone = ?, logo_url = ?, primary_color = ?, accent_color = ?, landing = ?, updated_at = ?
          WHERE id = ?
        `)
        .bind(name, slug, timezone, logoUrl, primaryColor, accentColor, landingStr, now, body.id)
        .run();

      return json({ ok: true });
    }

    throw new HttpError(405, 'Method not allowed');
  } catch (err) {
    return errorResponse(err);
  }
};
