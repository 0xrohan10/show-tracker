import { stmt } from '$lib/server/db.js';
import { error } from '@sveltejs/kit';

export function load({ params }) {
  const show = stmt.getShowById.get(Number(params.id));
  if (!show) throw error(404, 'show not found');

  const episodes = stmt.episodesByShow.all(show.id);

  // group by season
  const seasons = new Map();
  for (const ep of episodes) {
    const s = ep.season ?? 0;
    if (!seasons.has(s)) seasons.set(s, []);
    seasons.get(s).push(ep);
  }

  return {
    show,
    seasons: Array.from(seasons.entries())
      .sort(([a], [b]) => a - b)
      .map(([num, episodes]) => ({ num, episodes }))
  };
}
