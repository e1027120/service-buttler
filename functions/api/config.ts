import { type Env, json } from '../../server/db';

export const onRequestGet: PagesFunction<Env> = async () => {
  return json(
    {
      provider: 'cloudflare',
      db: 'd1',
      storage: 'r2',
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=300',
      },
    }
  );
};
