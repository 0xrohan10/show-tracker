import { stmt, type EpisodeRow } from '$lib/server/db';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
  const show = stmt.getShowById.get(Number(params.id));
  if (!show) throw error(404, 'show not found');

  const episodes = stmt.episodesByShow.all(show.id);

  const seasons = new Map<number, EpisodeRow[]>();
  for (const ep of episodes) {
    const s = ep.season ?? 0;
    if (!seasons.has(s)) seasons.set(s, []);
    seasons.get(s)!.push(ep);
  }

  return {
    show,
    seasons: Array.from(seasons.entries())
      .sort(([a], [b]) => a - b)
      .map(([num, episodes]) => ({ num, episodes }))
  };
};
