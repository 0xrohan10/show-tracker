const BASE = 'https://api.tvmaze.com';

export async function searchShows(query) {
  const r = await fetch(`${BASE}/search/shows?q=${encodeURIComponent(query)}`);
  if (!r.ok) throw new Error(`tvmaze search failed: ${r.status}`);
  const data = await r.json();
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

export async function fetchShow(tvmazeId) {
  const r = await fetch(`${BASE}/shows/${tvmazeId}`);
  if (!r.ok) throw new Error(`tvmaze show ${tvmazeId} failed: ${r.status}`);
  const s = await r.json();
  return {
    tvmaze_id: s.id,
    name: s.name,
    image: s.image?.original || s.image?.medium || null,
    network: s.network?.name || s.webChannel?.name || null,
    status: s.status,
    summary: stripHtml(s.summary)
  };
}

export async function fetchEpisodes(tvmazeId) {
  const r = await fetch(`${BASE}/shows/${tvmazeId}/episodes`);
  if (!r.ok) throw new Error(`tvmaze episodes ${tvmazeId} failed: ${r.status}`);
  const data = await r.json();
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

function stripHtml(s) {
  if (!s) return null;
  return s.replace(/<[^>]+>/g, '').trim();
}
