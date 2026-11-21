import { type Env } from '../../../../server/db';

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const churchId = ctx.params.churchId as string;
  const file = ctx.params.file as string;

  if (!churchId || !file) {
    return new Response('Not found', { status: 404 });
  }

  const key = `${churchId}/${file}`;
  const object = await ctx.env.ASSETS_BUCKET.get(key);

  if (!object) {
    return new Response('Asset not found', { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.etag);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');

  return new Response(object.body, { headers });
};
