import { env } from '$env/dynamic/private';

const BASE = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';

function key() {
  const k = env.TMDB_API_KEY;
  if (!k) throw new Error('TMDB_API_KEY not set');
  return k;
}

function imgUrl(path, size = 'w342') {
  return path ? `${IMG}/${size}${path}` : null;
}

export async function searchShows(query) {
  const r = await fetch(`${BASE}/search/tv?query=${encodeURIComponent(query)}&api_key=${key()}`);
  if (!r.ok) throw new Error(`tmdb search failed: ${r.status}`);
  const data = await r.json();
  return data.results.map((s) => ({
    tmdb_id: s.id,
    name: s.name,
    image: imgUrl(s.poster_path, 'w185'),
    country: (s.origin_country && s.origin_country[0]) || null,
    status: null, // search results don't include status
    summary: s.overview || null,
    premiered: s.first_air_date || null,
    network: null // not in search results
  }));
}

export async function fetchShow(tmdbId) {
  const r = await fetch(`${BASE}/tv/${tmdbId}?api_key=${key()}`);
  if (!r.ok) throw new Error(`tmdb show ${tmdbId} failed: ${r.status}`);
  const s = await r.json();
  return {
    tmdb_id: s.id,
    name: s.name,
    image: imgUrl(s.poster_path),
    network: s.networks?.[0]?.name || null,
    country: (s.origin_country && s.origin_country[0]) || null,
    status: s.status,
    summary: s.overview || null,
    number_of_seasons: s.number_of_seasons || 0
  };
}

export async function findTmdbIdByImdb(imdbId) {
  const r = await fetch(`${BASE}/find/${imdbId}?api_key=${key()}&external_source=imdb_id`);
  if (!r.ok) return null;
  const data = await r.json();
  return data.tv_results?.[0]?.id || null;
}

export async function fetchWatchProviders(tmdbId, country = 'CA') {
  const r = await fetch(`${BASE}/tv/${tmdbId}/watch/providers?api_key=${key()}`);
  if (!r.ok) return null;
  const data = await r.json();
  const region = data.results?.[country];
  if (!region) return null;
  // prefer flatrate (subscription), then free, then ads
  const provider = region.flatrate?.[0] || region.free?.[0] || region.ads?.[0] || null;
  if (!provider) return null;
  return {
    name: provider.provider_name,
    logo: provider.logo_path ? `${IMG}/w45${provider.logo_path}` : null
  };
}

export async function fetchExternalIds(tmdbId) {
  const r = await fetch(`${BASE}/tv/${tmdbId}/external_ids?api_key=${key()}`);
  if (!r.ok) throw new Error(`tmdb external_ids ${tmdbId} failed: ${r.status}`);
  const data = await r.json();
  return {
    imdb_id: data.imdb_id || null,
    tvdb_id: data.tvdb_id || null
  };
}

export async function fetchEpisodes(tmdbId) {
  const show = await fetchShow(tmdbId);
  const episodes = [];
  for (let s = 1; s <= show.number_of_seasons; s++) {
    const r = await fetch(`${BASE}/tv/${tmdbId}/season/${s}?api_key=${key()}`);
    if (!r.ok) continue; // some seasons may 404 (specials, etc.)
    const season = await r.json();
    for (const e of season.episodes || []) {
      episodes.push({
        season: e.season_number,
        number: e.episode_number,
        name: e.name || null,
        airdate: e.air_date || null,
        airtime: null, // TMDB doesn't provide airtimes
        runtime: e.runtime || null,
        summary: e.overview || null,
        image: imgUrl(e.still_path, 'w300')
      });
    }
  }
  return episodes;
}
