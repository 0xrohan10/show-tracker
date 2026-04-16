import { db, stmt, type ShowRow } from './db';
import { fetchShow as fetchTvmazeShow, fetchEpisodes as fetchTvmazeEpisodes, type TvmazeEpisode } from './tvmaze';
import {
  fetchShow as fetchTmdbShow,
  fetchEpisodes as fetchTmdbEpisodes,
  fetchExternalIds,
  fetchWatchProviders,
  findTmdbIdByImdb,
  type TmdbEpisode
} from './tmdb';

interface EpisodeData {
  season: number;
  number: number;
  name: string | null;
  airdate: string | null;
  airtime: string | null;
  runtime: number | null;
  summary: string | null;
  image: string | null;
}

export interface RefreshResult {
  id: number;
  name: string;
  ok: boolean;
  error?: string;
}

/**
 * Look up a tvmaze ID from a TMDB show's external IDs (via IMDB).
 */
export async function resolveTvmazeId(tmdbId: number): Promise<number | null> {
  try {
    const ext = await fetchExternalIds(tmdbId);
    if (!ext.imdb_id) return null;
    const r = await fetch(`https://api.tvmaze.com/lookup/shows?imdb=${ext.imdb_id}`);
    if (!r.ok) return null;
    const show = await r.json() as { id?: number } | null;
    return show?.id || null;
  } catch {
    return null;
  }
}

/**
 * Merge episode data: tvmaze for airtimes, backfill name/summary from TMDB
 * when tvmaze data is missing or generic.
 */
function mergeEpisodes(tvmazeEps: TvmazeEpisode[], tmdbEps: TmdbEpisode[]): TvmazeEpisode[] {
  const tmdbIndex = new Map<string, TmdbEpisode>();
  for (const e of tmdbEps) {
    tmdbIndex.set(`${e.season}-${e.number}`, e);
  }

  return tvmazeEps.map((ep) => {
    const tmdbEp = tmdbIndex.get(`${ep.season}-${ep.number}`);
    if (!tmdbEp) return ep;
    return {
      ...ep,
      name: (ep.name && !/^Episode \d+$/i.test(ep.name)) ? ep.name : (tmdbEp.name || ep.name),
      summary: ep.summary || tmdbEp.summary || null,
      image: ep.image || tmdbEp.image || null
    };
  });
}

/**
 * Track a new show from TMDB search results.
 */
export async function trackFromTmdb(tmdbId: number): Promise<ShowRow> {
  const [show, tvmazeId, provider] = await Promise.all([
    fetchTmdbShow(tmdbId),
    resolveTvmazeId(tmdbId),
    fetchWatchProviders(tmdbId)
  ]);

  const row = stmt.insertShowByTmdb.get(
    tvmazeId, show.tmdb_id, show.name, show.image,
    show.network, show.status, show.summary,
    provider?.name || null, provider?.logo || null
  );
  if (!row) throw new Error(`failed to insert show ${show.name}`);

  let episodes: EpisodeData[] | null = null;
  if (tvmazeId) {
    try {
      const tvmazeEps = await fetchTvmazeEpisodes(tvmazeId);
      const tmdbEps = await fetchTmdbEpisodes(tmdbId);
      episodes = mergeEpisodes(tvmazeEps, tmdbEps);
    } catch {
      episodes = null;
    }
  }
  if (!episodes) {
    episodes = await fetchTmdbEpisodes(tmdbId);
  }

  const eps = episodes;
  const tx = db.transaction(() => {
    stmt.deleteEpisodesForShow.run(row.id);
    for (const e of eps) {
      stmt.upsertEpisode.run(
        row.id, e.season, e.number, e.name,
        e.airdate, e.airtime, e.runtime, e.summary, e.image
      );
    }
    stmt.markRefreshed.run(row.id);
  });
  tx();
  return row;
}

/**
 * Refresh a single show's episode data.
 */
export async function refreshShow(showId: number): Promise<ShowRow> {
  const row = stmt.getShowById.get(showId);
  if (!row) throw new Error(`show ${showId} not found`);

  let tmdbId: number | null = row.tmdb_id;
  if (!tmdbId && row.tvmaze_id) {
    try {
      const r = await fetch(`https://api.tvmaze.com/shows/${row.tvmaze_id}`);
      if (r.ok) {
        const tvShow = await r.json() as { externals?: { imdb?: string } };
        const imdbId = tvShow.externals?.imdb;
        if (imdbId) {
          tmdbId = await findTmdbIdByImdb(imdbId);
        }
      }
    } catch { /* best effort */ }
  }

  let watchingOn = row.watching_on;
  let watchingOnLogo = row.watching_on_logo;
  if (tmdbId) {
    try {
      const provider = await fetchWatchProviders(tmdbId);
      if (provider) {
        watchingOn = provider.name;
        watchingOnLogo = provider.logo;
      }
    } catch { /* best effort */ }
  }

  let episodes: EpisodeData[] | null = null;
  if (row.tvmaze_id) {
    try {
      const show = await fetchTvmazeShow(row.tvmaze_id);
      stmt.insertShow.get(
        show.tvmaze_id, tmdbId || row.tmdb_id, show.name, show.image,
        show.network, show.status, show.summary, watchingOn, watchingOnLogo
      );

      const tvmazeEps = await fetchTvmazeEpisodes(row.tvmaze_id);
      if (tmdbId) {
        try {
          const tmdbEps = await fetchTmdbEpisodes(tmdbId);
          episodes = mergeEpisodes(tvmazeEps, tmdbEps);
        } catch {
          episodes = tvmazeEps;
        }
      } else {
        episodes = tvmazeEps;
      }
    } catch {
      episodes = null;
    }
  }

  if (!episodes && (tmdbId || row.tmdb_id)) {
    const id = (tmdbId || row.tmdb_id)!;
    const show = await fetchTmdbShow(id);
    stmt.insertShowByTmdb.get(
      row.tvmaze_id, show.tmdb_id, show.name, show.image,
      show.network, show.status, show.summary, watchingOn, watchingOnLogo
    );
    episodes = await fetchTmdbEpisodes(id);
  }

  if (!episodes) throw new Error(`no source available for show ${row.name}`);

  const eps = episodes;
  const tx = db.transaction(() => {
    stmt.deleteEpisodesForShow.run(row.id);
    for (const e of eps) {
      stmt.upsertEpisode.run(
        row.id, e.season, e.number, e.name,
        e.airdate, e.airtime, e.runtime, e.summary, e.image
      );
    }
    stmt.markRefreshed.run(row.id);
  });
  tx();
  return row;
}

/**
 * Refresh all tracked shows.
 */
export async function refreshAll(): Promise<RefreshResult[]> {
  const shows = stmt.listShows.all();
  const results: RefreshResult[] = [];
  for (const s of shows) {
    try {
      await refreshShow(s.id);
      results.push({ id: s.id, name: s.name, ok: true });
    } catch (err) {
      results.push({ id: s.id, name: s.name, ok: false, error: String(err) });
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return results;
}
