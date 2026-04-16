const BASE = 'https://api.tvmaze.com';

export interface TvmazeSearchResult {
  tvmaze_id: number;
  name: string;
  image: string | null;
  network: string | null;
  country: string | null;
  status: string;
  summary: string | null;
  premiered: string | null;
}

export interface TvmazeShow {
  tvmaze_id: number;
  name: string;
  image: string | null;
  network: string | null;
  status: string;
  summary: string | null;
}

export interface TvmazeEpisode {
  tvmaze_id: number;
  season: number;
  number: number;
  name: string | null;
  airdate: string | null;
  airtime: string | null;
  runtime: number | null;
  summary: string | null;
  image: string | null;
}

interface TvmazeImage { medium?: string; original?: string }
interface TvmazeChannel { name?: string; country?: { code?: string } }
interface TvmazeRawShow {
  id: number;
  name: string;
  image?: TvmazeImage | null;
  network?: TvmazeChannel | null;
  webChannel?: TvmazeChannel | null;
  status: string;
  summary: string | null;
  premiered: string | null;
}
interface TvmazeRawEpisode {
  id: number;
  season: number;
  number: number;
  name: string | null;
  airdate: string | null;
  airtime: string | null;
  runtime: number | null;
  summary: string | null;
  image?: TvmazeImage | null;
}

export async function searchShows(query: string): Promise<TvmazeSearchResult[]> {
  const r = await fetch(`${BASE}/search/shows?q=${encodeURIComponent(query)}`);
  if (!r.ok) throw new Error(`tvmaze search failed: ${r.status}`);
  const data = await r.json() as { show: TvmazeRawShow }[];
  return data.map(({ show }) => ({
    tvmaze_id: show.id,
    name: show.name,
    image: show.image?.medium || null,
    network: show.network?.name || show.webChannel?.name || null,
    country: show.network?.country?.code || show.webChannel?.country?.code || null,
    status: show.status,
    summary: stripHtml(show.summary),
    premiered: show.premiered
  }));
}

export async function fetchShow(tvmazeId: number): Promise<TvmazeShow> {
  const r = await fetch(`${BASE}/shows/${tvmazeId}`);
  if (!r.ok) throw new Error(`tvmaze show ${tvmazeId} failed: ${r.status}`);
  const s = await r.json() as TvmazeRawShow;
  return {
    tvmaze_id: s.id,
    name: s.name,
    image: s.image?.original || s.image?.medium || null,
    network: s.network?.name || s.webChannel?.name || null,
    status: s.status,
    summary: stripHtml(s.summary)
  };
}

export async function fetchEpisodes(tvmazeId: number): Promise<TvmazeEpisode[]> {
  const r = await fetch(`${BASE}/shows/${tvmazeId}/episodes`);
  if (!r.ok) throw new Error(`tvmaze episodes ${tvmazeId} failed: ${r.status}`);
  const data = await r.json() as TvmazeRawEpisode[];
  return data.map((e) => ({
    tvmaze_id: e.id,
    season: e.season,
    number: e.number,
    name: e.name,
    airdate: e.airdate || null,
    airtime: e.airtime || null,
    runtime: e.runtime || null,
    summary: stripHtml(e.summary),
    image: e.image?.medium || null
  }));
}

function stripHtml(s: string | null | undefined): string | null {
  if (!s) return null;
  return s.replace(/<[^>]+>/g, '').trim();
}
