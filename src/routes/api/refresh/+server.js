import { refreshAll } from '$lib/server/refresh.js';
import { json } from '@sveltejs/kit';

export async function POST() {
  const results = await refreshAll();
  return json({ ok: true, results });
}

export async function GET() {
  const results = await refreshAll();
  return json({ ok: true, results });
}
