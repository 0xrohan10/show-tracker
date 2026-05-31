import { db, stmt, type TeamRow } from './db';

export interface TrackableTeam {
  slug: string;
  sport: string;
  league: string;
  external_id: string;
  name: string;
  short_name: string;
  logo: string | null;
  primary_color: string;
}

interface GameData {
  external_id: string;
  game_date: string;
  starts_at: string | null;
  status: string | null;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  home_starting_pitcher: string | null;
  away_starting_pitcher: string | null;
  tv_channel: string | null;
  venue: string | null;
}

export interface TeamRefreshResult {
  id: number;
  name: string;
  ok: boolean;
  error?: string;
}

export const TRACKABLE_TEAMS: TrackableTeam[] = [
  {
    slug: 'blue-jays',
    sport: 'baseball',
    league: 'MLB',
    external_id: '141',
    name: 'Toronto Blue Jays',
    short_name: 'Jays',
    logo: 'https://a.espncdn.com/i/teamlogos/mlb/500/tor.png',
    primary_color: '#134A8E'
  },
  {
    slug: 'argos',
    sport: 'football',
    league: 'CFL',
    external_id: 'argos-official',
    name: 'Toronto Argonauts',
    short_name: 'Argos',
    logo: 'https://www.argonauts.ca/wp-content/themes/argonauts.ca/images/apple-touch-icon-180x180.png',
    primary_color: '#0A2240'
  }
];

const CFL_TEAM_NAMES: Record<string, string> = {
  BC: 'BC Lions',
  CGY: 'Calgary Stampeders',
  EDM: 'Edmonton Elks',
  HAM: 'Hamilton Tiger-Cats',
  MTL: 'Montreal Alouettes',
  OTT: 'Ottawa REDBLACKS',
  SSK: 'Saskatchewan Roughriders',
  TOR: 'Toronto Argonauts',
  WPG: 'Winnipeg Blue Bombers'
};

export async function trackTeam(slug: string): Promise<TeamRow> {
  const team = TRACKABLE_TEAMS.find((t) => t.slug === slug);
  if (!team) throw new Error(`unsupported team ${slug}`);

  const row = upsertTeam(team);
  await refreshTeam(row.id);
  return row;
}

export async function ensureDefaultTeamsTracked(): Promise<TeamRefreshResult[]> {
  const results: TeamRefreshResult[] = [];
  for (const team of TRACKABLE_TEAMS) {
    const row = upsertTeam(team);
    if (!needsRefresh(row)) continue;

    try {
      await refreshTeam(row.id);
      results.push({ id: row.id, name: row.name, ok: true });
    } catch (err) {
      results.push({ id: row.id, name: row.name, ok: false, error: String(err) });
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return results;
}

export async function refreshTeam(teamId: number): Promise<TeamRow> {
  const row = stmt.getTeamById.get(teamId);
  if (!row) throw new Error(`team ${teamId} not found`);

  const games = await fetchGames(row.slug);
  const tx = db.transaction(() => {
    stmt.deleteGamesForTeam.run(row.id);
    for (const game of games) {
      stmt.upsertGame.run(
        row.id,
        game.external_id,
        game.game_date,
        game.starts_at,
        game.status,
        game.home_team,
        game.away_team,
        game.home_score,
        game.away_score,
        game.home_starting_pitcher,
        game.away_starting_pitcher,
        game.tv_channel,
        game.venue
      );
    }
    stmt.markTeamRefreshed.run(row.id);
  });
  tx();
  return row;
}

export async function refreshAllTeams(): Promise<TeamRefreshResult[]> {
  const teams = stmt.listTeams.all();
  const results: TeamRefreshResult[] = [];
  for (const team of teams) {
    try {
      await refreshTeam(team.id);
      results.push({ id: team.id, name: team.name, ok: true });
    } catch (err) {
      results.push({ id: team.id, name: team.name, ok: false, error: String(err) });
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return results;
}

async function fetchGames(slug: string): Promise<GameData[]> {
  if (slug === 'blue-jays') return fetchBlueJaysGames();
  if (slug === 'argos') return fetchArgosGames();
  throw new Error(`unsupported team ${slug}`);
}

function upsertTeam(team: TrackableTeam): TeamRow {
  const row = stmt.insertTeam.get(
    team.slug, team.sport, team.league, team.external_id,
    team.name, team.short_name, team.logo, team.primary_color
  );
  if (!row) throw new Error(`failed to insert team ${team.name}`);
  return row;
}

function needsRefresh(team: TeamRow): boolean {
  if (!team.last_refreshed_at) return true;
  return team.last_refreshed_at.slice(0, 10) < new Date().toISOString().slice(0, 10);
}

async function fetchBlueJaysGames(): Promise<GameData[]> {
  const year = new Date().getFullYear();
  const url = new URL('https://statsapi.mlb.com/api/v1/schedule');
  url.searchParams.set('sportId', '1');
  url.searchParams.set('teamId', '141');
  url.searchParams.set('startDate', `${year}-01-01`);
  url.searchParams.set('endDate', `${year}-12-31`);
  url.searchParams.set('hydrate', 'team,venue,linescore,status,probablePitcher,broadcasts');

  const res = await fetch(url);
  if (!res.ok) throw new Error(`mlb schedule failed: ${res.status}`);
  const data = await res.json() as MlbScheduleResponse;

  return (data.dates || []).flatMap((date) => (date.games || []).map((game) => ({
    external_id: String(game.gamePk),
    game_date: date.date,
    starts_at: game.gameDate || null,
    status: game.status?.detailedState || null,
    home_team: game.teams.home.team.name,
    away_team: game.teams.away.team.name,
    home_score: score(game.teams.home.score),
    away_score: score(game.teams.away.score),
    home_starting_pitcher: game.teams.home.probablePitcher?.fullName || null,
    away_starting_pitcher: game.teams.away.probablePitcher?.fullName || null,
    tv_channel: pickMlbTvChannel(game),
    venue: game.venue?.name || null
  })));
}

async function fetchArgosGames(): Promise<GameData[]> {
  const res = await fetch('https://www.argonauts.ca/schedule/');
  if (!res.ok) throw new Error(`argos schedule failed: ${res.status}`);
  const html = await res.text();
  const markers = [...html.matchAll(/<div id="div-game-id-(\d+)" class="heading collapsible-header">/g)];

  return markers.flatMap((marker, index) => {
    const start = marker.index || 0;
    const end = markers[index + 1]?.index || html.length;
    const chunk = html.slice(start, end);
    const gameId = marker[1];
    const kickoff = match(chunk, /data-kickoff="([^"]+)"/);
    const timestamp = match(chunk, /Number\((\d+)\) \* 1000/);
    const startsAt = kickoff ? new Date(kickoff) : timestamp ? new Date(Number(timestamp) * 1000) : null;
    if (!startsAt || Number.isNaN(startsAt.getTime())) return [];

    const gameDate = kickoff ? kickoff.slice(0, 10) : startsAt.toISOString().slice(0, 10);
    const awayAbbr = match(chunk, /<span class="visitor">[\s\S]*?<span class="text">([^<]+)<\/span>/);
    const homeAbbr = match(chunk, /<span class="host">[\s\S]*?<span class="text">([^<]+)<\/span>/);
    if (!awayAbbr || !homeAbbr) return [];

    const status = clean(match(chunk, /<span class="status">([^<]*)<\/span>/));

    return [{
      external_id: gameId,
      game_date: gameDate,
      starts_at: startsAt.toISOString(),
      status: status || null,
      home_team: CFL_TEAM_NAMES[homeAbbr] || homeAbbr,
      away_team: CFL_TEAM_NAMES[awayAbbr] || awayAbbr,
      home_score: score(match(chunk, /<span class="host-score">([^<]*)<\/span>/)),
      away_score: score(match(chunk, /<span class="visitor-score">([^<]*)<\/span>/)),
      home_starting_pitcher: null,
      away_starting_pitcher: null,
      tv_channel: pickArgosTvChannel(chunk),
      venue: null
    }];
  });
}

function pickMlbTvChannel(game: MlbGame): string | null {
  const jaysSide = game.teams.home.team.name === 'Toronto Blue Jays' ? 'home' : 'away';
  const tvBroadcasts = (game.broadcasts || []).filter((broadcast) =>
    broadcast.type === 'TV' && broadcast.language === 'en'
  );
  const sideBroadcasts = tvBroadcasts.filter((broadcast) => broadcast.homeAway === jaysSide);
  const preferred = sideBroadcasts.find((broadcast) =>
    /Sportsnet|\bSN\d?\b/i.test(`${broadcast.name} ${broadcast.callSign || ''}`)
  ) || tvBroadcasts.find((broadcast) =>
    /Sportsnet|\bSN\d?\b/i.test(`${broadcast.name} ${broadcast.callSign || ''}`)
  ) || sideBroadcasts[0] || tvBroadcasts[0];

  return normalizeMlbChannel(preferred?.callSign || preferred?.name || null);
}

function normalizeMlbChannel(channel: string | null): string | null {
  if (!channel) return null;
  if (/Sportsnet/i.test(channel)) return 'Sportsnet';
  if (/\bSN1\b/i.test(channel)) return 'SN1';
  return channel.trim();
}

function pickArgosTvChannel(chunk: string): string | null {
  const channels = [...chunk.matchAll(/logo-([a-z0-9]+)\.svg/gi)].map((match) => match[1].toLowerCase());
  if (channels.includes('tsn')) return 'TSN';
  if (channels.includes('ctv')) return 'CTV';
  if (channels.includes('rds')) return 'RDS';
  if (channels.includes('cflplus')) return 'CFL+';
  return null;
}

function match(input: string, regex: RegExp): string | null {
  return input.match(regex)?.[1]?.trim() || null;
}

function clean(value: string | null): string | null {
  if (!value) return null;
  return value.replace(/&amp;/g, '&').trim() || null;
}

function score(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

interface MlbScheduleResponse {
  dates?: Array<{
    date: string;
    games?: MlbGame[];
  }>;
}

interface MlbGame {
  gamePk: number;
  gameDate?: string;
  status?: { detailedState?: string };
  teams: {
    home: { team: { name: string }; score?: number; probablePitcher?: { fullName?: string } };
    away: { team: { name: string }; score?: number; probablePitcher?: { fullName?: string } };
  };
  broadcasts?: MlbBroadcast[];
  venue?: { name?: string };
}

interface MlbBroadcast {
  name: string;
  type: string;
  language?: string;
  callSign?: string;
  homeAway?: 'home' | 'away';
}
