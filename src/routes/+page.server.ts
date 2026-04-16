import { stmt } from '$lib/server/db';
import { refreshAll, refreshShow, trackFromTmdb } from '$lib/server/refresh';
import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async () => {
  const upcoming = stmt.upcomingEpisodes.all();
  const shows = stmt.listShows.all();

  const seasonMax = stmt.seasonMaxEpisodes.all();
  const finaleMap = new Map<string, typeof seasonMax[number]>();
  for (const row of seasonMax) {
    finaleMap.set(`${row.show_id}-${row.season}`, row);
  }
  const showStatus = new Map(shows.map((s) => [s.id, s.status]));

  for (const ep of upcoming) {
    const key = `${ep.show_id}-${ep.season}`;
    const info = finaleMap.get(key);
    if (info && ep.number === info.max_number) {
      const isLastSeason = ep.season === info.max_season;
      const ended = /ended/i.test(showStatus.get(ep.show_id) || '');
      ep.finale = isLastSeason && ended ? 'series' : 'season';
    }
  }

  const groups = new Map<string, typeof upcoming>();
  for (const ep of upcoming) {
    const key = ep.airdate || 'tba';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(ep);
  }
  const grouped = Array.from(groups.entries()).map(([date, episodes]) => ({ date, episodes }));

  const tracked = new Set(shows.filter((s) => s.tmdb_id).map((s) => s.tmdb_id!));

  return { grouped, shows, tracked };
};

export const actions: Actions = {
  refresh: async () => {
    const results = await refreshAll();
    return { refreshed: results };
  },
  track: async ({ request }) => {
    const data = await request.formData();
    const tmdbId = Number(data.get('tmdb_id'));
    if (!tmdbId) return fail(400, { error: 'missing id' });
    try {
      await trackFromTmdb(tmdbId);
    } catch (err) {
      return fail(500, { error: String(err) });
    }
    return { tracked: tmdbId };
  },
  untrack: async ({ request }) => {
    const data = await request.formData();
    const showId = Number(data.get('show_id'));
    if (!showId) return fail(400, { error: 'missing id' });
    stmt.deleteShow.run(showId);
    return { untracked: showId };
  },
  refreshOne: async ({ request }) => {
    const data = await request.formData();
    const showId = Number(data.get('show_id'));
    if (!showId) return fail(400, { error: 'missing id' });
    await refreshShow(showId);
    return { refreshedOne: showId };
  }
};
