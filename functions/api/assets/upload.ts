import { assertChurchRole, authenticate } from '../../../server/auth';
import { type Env, errorResponse, HttpError, json } from '../../../server/db';

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const { user } = await authenticate(ctx.request, ctx.env);
    const formData = await ctx.request.formData();
    const churchId = formData.get('church_id') as string | null;
    const file = formData.get('file') as File | null;

    if (!churchId || !file) {
      throw new HttpError(400, 'church_id and file are required');
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new HttpError(400, 'Image must be smaller than 5 MB');
    }

    // Verify user belongs to this church
    await assertChurchRole(ctx.env.DB, churchId, user.id);

    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
    const filename = `${crypto.randomUUID()}.${ext}`;
    const key = `${churchId}/${filename}`;

    const arrayBuffer = await file.arrayBuffer();

    await ctx.env.ASSETS_BUCKET.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type || 'image/png',
        cacheControl: 'public, max-age=31536000, immutable',
      },
    });

    const publicUrl = `/api/assets/${churchId}/${filename}`;
    return json({ url: publicUrl }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
};
