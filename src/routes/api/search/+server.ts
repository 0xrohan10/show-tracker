import { searchShows } from '$lib/server/tmdb';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const q = url.searchParams.get('q')?.trim();
  const country = url.searchParams.get('country') || 'US,CA';
  if (!q) return json({ results: [] });

  try {
    let results = await searchShows(q);
    if (country !== 'all') {
      const codes = new Set(country.split(','));
      results.sort((a, b) => {
        const aMatch = !a.country || codes.has(a.country) ? 0 : 1;
        const bMatch = !b.country || codes.has(b.country) ? 0 : 1;
        return aMatch - bMatch;
      });
    }
    results = results.slice(0, 10);
    return json({ results });
  } catch (err) {
    return json({ results: [], error: String(err) }, { status: 500 });
  }
};
