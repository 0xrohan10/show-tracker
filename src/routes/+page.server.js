import { stmt } from '$lib/server/db.js';
import { refreshAll, refreshShow, trackFromTmdb } from '$lib/server/refresh.js';
import { fail } from '@sveltejs/kit';

export async function load() {
  const upcoming = stmt.upcomingEpisodes.all();
  const shows = stmt.listShows.all();

  // build finale lookup
  const seasonMax = stmt.seasonMaxEpisodes.all();
  const finaleMap = new Map();
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

  // group by airdate
  const groups = new Map();
  for (const ep of upcoming) {
    const key = ep.airdate || 'tba';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(ep);
  }
  const grouped = Array.from(groups.entries()).map(([date, episodes]) => ({ date, episodes }));

  const tracked = new Set(shows.filter((s) => s.tmdb_id).map((s) => s.tmdb_id));

  return { grouped, shows, tracked };
}

export const actions = {
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
