import { env } from '$env/dynamic/private';

const BASE = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';

export interface TmdbSearchResult {
  tmdb_id: number;
  name: string;
  image: string | null;
  country: string | null;
  status: null;
  summary: string | null;
  premiered: string | null;
  network: null;
}

export interface TmdbShow {
  tmdb_id: number;
  name: string;
  image: string | null;
  network: string | null;
  country: string | null;
  status: string | null;
  summary: string | null;
  number_of_seasons: number;
}

export interface TmdbEpisode {
  season: number;
  number: number;
  name: string | null;
  airdate: string | null;
  airtime: null;
  runtime: number | null;
  summary: string | null;
  image: string | null;
}

export interface TmdbWatchProvider {
  name: string;
  logo: string | null;
}

export interface TmdbExternalIds {
  imdb_id: string | null;
  tvdb_id: number | null;
}

function key(): string {
  const k = env.TMDB_API_KEY;
  if (!k) throw new Error('TMDB_API_KEY not set');
  return k;
}

function imgUrl(path: string | null | undefined, size = 'w342'): string | null {
  return path ? `${IMG}/${size}${path}` : null;
}

const STATUS_MAP: Record<string, string> = {
  'Returning Series': 'Returning',
  'In Production': 'In Production',
  'Planned': 'Planned',
  'Canceled': 'Canceled',
  'Ended': 'Ended',
};

function normalizeStatus(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return STATUS_MAP[raw] || raw;
}

interface TmdbRawSearchItem {
  id: number;
  name: string;
  poster_path: string | null;
  origin_country: string[] | null;
  overview: string | null;
  first_air_date: string | null;
}

interface TmdbRawShow {
  id: number;
  name: string;
  poster_path: string | null;
  networks?: { name: string }[];
  origin_country?: string[];
  status: string | null;
  overview: string | null;
  number_of_seasons: number | null;
}

interface TmdbRawEpisode {
  season_number: number;
  episode_number: number;
  name: string | null;
  air_date: string | null;
  runtime: number | null;
  overview: string | null;
  still_path: string | null;
}

interface TmdbRawProvider {
  provider_name: string;
  logo_path: string | null;
}

export async function searchShows(query: string): Promise<TmdbSearchResult[]> {
  const r = await fetch(`${BASE}/search/tv?query=${encodeURIComponent(query)}&api_key=${key()}`);
  if (!r.ok) throw new Error(`tmdb search failed: ${r.status}`);
  const data = await r.json() as { results: TmdbRawSearchItem[] };
  return data.results.map((s) => ({
    tmdb_id: s.id,
    name: s.name,
    image: imgUrl(s.poster_path, 'w185'),
    country: (s.origin_country && s.origin_country[0]) || null,
    status: null,
    summary: s.overview || null,
    premiered: s.first_air_date || null,
    network: null
  }));
}

export async function fetchShow(tmdbId: number): Promise<TmdbShow> {
  const r = await fetch(`${BASE}/tv/${tmdbId}?api_key=${key()}`);
  if (!r.ok) throw new Error(`tmdb show ${tmdbId} failed: ${r.status}`);
  const s = await r.json() as TmdbRawShow;
  return {
    tmdb_id: s.id,
    name: s.name,
    image: imgUrl(s.poster_path),
    network: s.networks?.[0]?.name || null,
    country: (s.origin_country && s.origin_country[0]) || null,
    status: normalizeStatus(s.status),
    summary: s.overview || null,
    number_of_seasons: s.number_of_seasons || 0
  };
}

export async function findTmdbIdByImdb(imdbId: string): Promise<number | null> {
  const r = await fetch(`${BASE}/find/${imdbId}?api_key=${key()}&external_source=imdb_id`);
  if (!r.ok) return null;
  const data = await r.json() as { tv_results?: { id: number }[] };
  return data.tv_results?.[0]?.id || null;
}

export async function fetchWatchProviders(tmdbId: number, country = 'CA'): Promise<TmdbWatchProvider | null> {
  const r = await fetch(`${BASE}/tv/${tmdbId}/watch/providers?api_key=${key()}`);
  if (!r.ok) return null;
  const data = await r.json() as {
    results?: Record<string, { flatrate?: TmdbRawProvider[]; free?: TmdbRawProvider[]; ads?: TmdbRawProvider[] }>;
  };
  const region = data.results?.[country];
  if (!region) return null;
  const provider = region.flatrate?.[0] || region.free?.[0] || region.ads?.[0] || null;
  if (!provider) return null;
  return {
    name: provider.provider_name,
    logo: provider.logo_path ? `${IMG}/w45${provider.logo_path}` : null
  };
}

export async function fetchExternalIds(tmdbId: number): Promise<TmdbExternalIds> {
  const r = await fetch(`${BASE}/tv/${tmdbId}/external_ids?api_key=${key()}`);
  if (!r.ok) throw new Error(`tmdb external_ids ${tmdbId} failed: ${r.status}`);
  const data = await r.json() as { imdb_id: string | null; tvdb_id: number | null };
  return {
    imdb_id: data.imdb_id || null,
    tvdb_id: data.tvdb_id || null
  };
}

export async function fetchEpisodes(tmdbId: number): Promise<TmdbEpisode[]> {
  const show = await fetchShow(tmdbId);
  const episodes: TmdbEpisode[] = [];
  for (let s = 1; s <= show.number_of_seasons; s++) {
    const r = await fetch(`${BASE}/tv/${tmdbId}/season/${s}?api_key=${key()}`);
    if (!r.ok) continue;
    const season = await r.json() as { episodes?: TmdbRawEpisode[] };
    for (const e of season.episodes || []) {
      episodes.push({
        season: e.season_number,
        number: e.episode_number,
        name: e.name || null,
        airdate: e.air_date || null,
        airtime: null,
        runtime: e.runtime || null,
        summary: e.overview || null,
        image: imgUrl(e.still_path, 'w300')
      });
    }
  }
  return episodes;
}
