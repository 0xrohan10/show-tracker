import { refreshAll } from '$lib/server/refresh';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async () => {
  const results = await refreshAll();
  return json({ ok: true, results });
};

export const GET: RequestHandler = async () => {
  const results = await refreshAll();
  return json({ ok: true, results });
};
