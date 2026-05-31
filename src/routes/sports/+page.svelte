<script lang="ts">
  import { enhance } from '$app/forms';
  import { RefreshCw } from 'lucide-svelte';
  import type { ActionData, PageData } from './$types';

  export let data: PageData;
  export let form: ActionData;

  type Game = PageData['gameGroups'][number]['games'][number];

  const CHANNEL_LOGOS: Record<string, string> = {
    sportsnet: 'https://www.sportsnet.ca/_next/static/media/sn_logo_512x512_bg_white.84fb1e2a.svg',
    sn1: 'https://www.sportsnet.ca/_next/static/media/sn_logo_512x512_bg_white.84fb1e2a.svg',
    tsn: 'https://www.argonauts.ca/wp-content/themes/cfl.ca/images/logo-tsn.svg',
    rds: 'https://www.argonauts.ca/wp-content/themes/cfl.ca/images/logo-rds.svg',
    'cfl+': 'https://www.argonauts.ca/wp-content/themes/cfl.ca/images/logo-cflplus.svg'
  };

  function formatDate(iso: string): string {
    const d = new Date(iso + 'T00:00:00');
    const today = new Date(); today.setHours(0,0,0,0);
    const tmrw = new Date(today); tmrw.setDate(today.getDate()+1);
    const yest = new Date(today); yest.setDate(today.getDate()-1);
    if (d.getTime() === yest.getTime()) return 'Yesterday';
    if (d.getTime() === today.getTime()) return 'Today';
    if (d.getTime() === tmrw.getTime()) return 'Tomorrow';
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  }

  function formatGameTime(iso: string | null): string {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  function initial(name: string): string {
    return name.trim().slice(0, 1).toUpperCase();
  }

  function locationLabel(game: Game): string {
    return game.is_home ? 'home' : 'away';
  }

  function matchupLabel(game: Game): string {
    return game.is_home ? `vs ${game.away_team}` : `@ ${game.home_team}`;
  }

  function jaysStarter(game: Game): string | null {
    if (game.team_slug !== 'blue-jays') return null;
    return game.is_home ? game.home_starting_pitcher : game.away_starting_pitcher;
  }

  function attendanceKey(game: Game): string {
    return `${game.team_id}:${game.external_id}`;
  }

  function attendanceLabel(game: Game): string | null {
    if (game.attending === 1) return 'attending';
    return null;
  }

  function channelLogo(channel: string | null): string | null {
    if (!channel) return null;
    const normalized = channel.toLowerCase().replace(/\s+/g, '');
    if (normalized.includes('sportsnet')) return CHANNEL_LOGOS.sportsnet;
    return CHANNEL_LOGOS[normalized] || null;
  }

  let refreshing = false;
  let refreshingTeam: number | null = null;
  let settingAttendance: string | null = null;
</script>

<svelte:head>
  <title>Sports · Tracker</title>
</svelte:head>

<div class="sports-header">
  <div>
    <p class="eyebrow">sports</p>
    <h2>Jays and Argos</h2>
    <p class="muted">Teams, schedules, and upcoming games live on this page.</p>
  </div>
  <form method="POST" action="?/refresh" use:enhance={() => {
    refreshing = true;
    return async ({ update }) => { await update(); refreshing = false; };
  }}>
    <button class="btn ghost" disabled={refreshing || data.teams.length === 0}>
      <span class:spin={refreshing}><RefreshCw size={14} /></span>
      {refreshing ? 'refreshing…' : 'refresh sports'}
    </button>
  </form>
</div>

{#if form?.error}
  <p class="error-msg">{form.error}</p>
{/if}

{#if form?.refreshed}
  <p class="refresh-notice">
    refreshed {form.refreshed.length} team{form.refreshed.length === 1 ? '' : 's'}
    {#if form.refreshed.some(r => !r.ok)}<span class="refresh-warn"> · some failed</span>{/if}
  </p>
{/if}

{#if data.bootstrapResults.some(r => !r.ok)}
  <p class="error-msg">could not refresh every schedule. use refresh sports to try again.</p>
{/if}

<section class="team-grid">
  {#each data.teamCards as team}
    <div class="card team-card" class:pending={refreshingTeam === team.id}>
      <div class="team-card-top">
        <div class="team-logo-box" style:background-color={team.primary_color}>
          {#if team.logo}
            <img src={team.logo} alt="" class="team-logo" />
          {:else}
            <div class="team-logo-placeholder">{initial(team.short_name)}</div>
          {/if}
        </div>
        <div class="team-card-info">
          <div class="team-name">{team.short_name}</div>
          <div class="team-meta">{team.name} · {team.league}</div>
        </div>
        <span class="tag">schedule</span>
      </div>

      {#if team.next_game}
        <div class="next-game">
          <div class="next-game-heading">
            <div class="label">next game</div>
            <span class:home-location={Boolean(team.next_game.is_home)} class:away-location={!team.next_game.is_home} class="location-badge">
              {locationLabel(team.next_game)}
            </span>
          </div>
          <div class="game-line">{matchupLabel(team.next_game)}</div>
          <div class="team-meta">
            {formatDate(team.next_game.game_date)}
            {#if team.next_game.starts_at}<span class="sep">·</span> {formatGameTime(team.next_game.starts_at)}{/if}
            {#if team.next_game.tv_channel}
              {@const logo = channelLogo(team.next_game.tv_channel)}
              <span class="sep">·</span>
              <span class="tv-channel" title={`TV: ${team.next_game.tv_channel}`}>
                {#if logo}
                  <img src={logo} alt={team.next_game.tv_channel} />
                {:else}
                  <span>{team.next_game.tv_channel}</span>
                {/if}
              </span>
            {/if}
          </div>
          {#if jaysStarter(team.next_game)}
            <div class="starter-line">Jays starter: {jaysStarter(team.next_game)}</div>
          {/if}
          {#if attendanceLabel(team.next_game)}
            <div class="attendance-note">
              {attendanceLabel(team.next_game)}
            </div>
          {/if}
        </div>
      {:else}
        <div class="next-game muted">Schedule is empty. Refresh to try again.</div>
      {/if}

      <div class="team-actions">
        {#if team.id}
          <form method="POST" action="?/refreshTeam" use:enhance={() => {
            refreshingTeam = team.id;
            return async ({ update }) => { await update(); refreshingTeam = null; };
          }}>
            <input type="hidden" name="team_id" value={team.id} />
            <button class="btn ghost btn-sm" disabled={refreshingTeam === team.id}>
              <span class:spin={refreshingTeam === team.id}><RefreshCw size={12} /></span>
              refresh
            </button>
          </form>
        {/if}
      </div>
    </div>
  {/each}
</section>

{#if data.gameGroups.length > 0}
  <section class="games-section">
    <h2 class="section-header">Upcoming Games</h2>
    {#each data.gameGroups as group}
      <section class="date-group">
        <h3 class="date-label">{formatDate(group.date)}</h3>
        <div class="card game-card">
          {#each group.games as game}
            <div class="game-row" class:home-game={Boolean(game.is_home)} class:away-game={!game.is_home}>
              <div class="game-logo-box" style:background-color={game.team_primary_color || undefined}>
                {#if game.team_logo}
                  <img src={game.team_logo} alt="" class="game-logo" />
                {:else}
                  <div class="game-logo-placeholder">{initial(game.team_name)}</div>
                {/if}
              </div>
              <div class="game-info">
                <div class="game-header">
                  <span class="game-title">{game.team_name}</span>
                  <span class="tag">{game.league}</span>
                  <span class:home-location={Boolean(game.is_home)} class:away-location={!game.is_home} class="location-badge">
                    {locationLabel(game)}
                  </span>
                  {#if attendanceLabel(game)}
                    <span class="attendance-pill">
                      {attendanceLabel(game)}
                    </span>
                  {/if}
                </div>
                <div class="game-meta">
                  {matchupLabel(game)}
                  {#if game.starts_at}<span class="sep">·</span> {formatGameTime(game.starts_at)}{/if}
                  {#if game.tv_channel}
                    {@const logo = channelLogo(game.tv_channel)}
                    <span class="sep">·</span>
                    <span class="tv-channel" title={`TV: ${game.tv_channel}`}>
                      {#if logo}
                        <img src={logo} alt={game.tv_channel} />
                      {:else}
                        <span>{game.tv_channel}</span>
                      {/if}
                    </span>
                  {/if}
                  {#if game.status && game.status !== 'Scheduled'}<span class="badge badge-season">{game.status}</span>{/if}
                </div>
                {#if game.away_score !== null && game.home_score !== null}
                  <div class="game-detail">{game.away_team} {game.away_score} · {game.home_team} {game.home_score}</div>
                {:else if game.venue}
                  <div class="game-detail">{game.venue}</div>
                {/if}
                {#if jaysStarter(game)}
                  <div class="starter-line">Jays starter: {jaysStarter(game)}</div>
                {/if}
                <div class="attendance-actions">
                  <form method="POST" action="?/setAttendance" use:enhance={() => {
                    settingAttendance = attendanceKey(game);
                    return async ({ update }) => { await update(); settingAttendance = null; };
                  }}>
                    <input type="hidden" name="team_id" value={game.team_id} />
                    <input type="hidden" name="external_id" value={game.external_id} />
                    <input type="hidden" name="attending" value={game.attending === 1 ? '0' : '1'} />
                    <button class="attendance-btn attend" class:active={game.attending === 1} disabled={settingAttendance === attendanceKey(game)}>
                      attending
                    </button>
                  </form>
                </div>
              </div>
            </div>
          {/each}
        </div>
      </section>
    {/each}
  </section>
{:else if data.teams.length > 0}
  <div class="empty compact"><p>no upcoming games. try hitting refresh.</p></div>
{/if}

<style>
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .spin {
    display: inline-flex;
    animation: spin 0.6s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  }

  .sports-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 16px;
    margin-bottom: 18px;
  }
  .eyebrow {
    margin: 0 0 4px;
    color: var(--muted);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  h2 { margin: 0; font-size: 22px; }
  .error-msg { color: var(--accent); font-size: 13px; margin: -8px 0 16px; }
  .refresh-notice { color: var(--muted); font-size: 13px; margin: -8px 0 16px; }
  .refresh-warn { color: var(--accent); }
  .sep { color: var(--faint); margin: 0 1px; }

  .team-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
  .team-card {
    padding: 14px;
    transition: opacity 200ms var(--ease), filter 200ms var(--ease);
  }
  .team-card.pending {
    opacity: 0.4;
    filter: blur(1px);
  }
  .team-card-top {
    display: grid;
    grid-template-columns: 44px 1fr auto;
    gap: 10px;
    align-items: center;
  }
  .team-logo-box {
    width: 44px;
    height: 44px;
    border-radius: var(--radius-sm);
    background: var(--faint);
    display: grid;
    place-items: center;
    overflow: hidden;
  }
  .team-logo {
    width: 100%;
    height: 100%;
    object-fit: contain;
    padding: 5px;
  }
  .team-logo-placeholder {
    display: grid;
    place-items: center;
    color: white;
    font-size: 14px;
    font-weight: 600;
  }
  .team-card-info { min-width: 0; }
  .team-name { font-size: 15px; font-weight: 600; color: var(--text); }
  .team-meta { color: var(--muted); font-size: 12px; margin-top: 2px; }
  .next-game {
    min-height: 52px;
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
    font-size: 13px;
  }
  .label {
    color: var(--muted);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .next-game-heading {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .game-line { margin-top: 3px; color: var(--text); font-weight: 500; }
  .tv-channel {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 20px;
    max-width: 86px;
    vertical-align: -5px;
  }
  .tv-channel img {
    display: block;
    width: auto;
    max-width: 86px;
    height: 20px;
    border-radius: 5px;
  }
  .tv-channel span {
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--muted);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.04em;
    line-height: 1;
    padding: 4px 6px;
    text-transform: uppercase;
  }
  .starter-line {
    color: var(--text);
    font-size: 12px;
    line-height: 1.5;
    margin-top: 4px;
  }
  .attendance-note {
    display: inline-flex;
    width: fit-content;
    border-radius: var(--radius-sm);
    background: rgba(69, 184, 121, 0.14);
    color: #76d49c;
    font-size: 11px;
    font-weight: 600;
    margin-top: 8px;
    padding: 4px 7px;
  }
  .team-actions { display: flex; gap: 6px; margin-top: 12px; }

  .games-section { margin-top: 32px; }
  .date-group { margin-bottom: 24px; }
  .date-label {
    font-size: 11px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--muted); margin: 0 0 8px;
  }
  .game-card { padding: 0 12px; }
  .game-row {
    display: grid; grid-template-columns: 52px 1fr; gap: 12px;
    align-items: start; padding: 12px;
    margin: 0 -12px;
    border-bottom: 1px solid var(--border);
    border-left: 4px solid transparent;
    transition: background 160ms var(--ease), box-shadow 160ms var(--ease);
  }
  .game-row.home-game {
    border-left-color: #8cc7ff;
    background:
      linear-gradient(90deg, rgba(88, 166, 255, 0.18), rgba(88, 166, 255, 0.05) 42%, transparent 75%),
      rgba(88, 166, 255, 0.04);
    box-shadow: inset 0 0 0 1px rgba(88, 166, 255, 0.14);
  }
  .game-row.away-game {
    border-left-color: rgba(255, 255, 255, 0.12);
  }
  .game-row:last-child { border-bottom: none; }
  .game-logo-box {
    width: 52px;
    height: 52px;
    border-radius: var(--radius-sm);
    background: var(--surface);
    display: grid;
    place-items: center;
    overflow: hidden;
  }
  .game-logo {
    width: 100%;
    height: 100%;
    object-fit: contain;
    padding: 6px;
  }
  .home-game .game-logo-box {
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.08), 0 8px 24px rgba(88, 166, 255, 0.12);
  }
  .game-logo-placeholder {
    display: grid;
    place-items: center;
    color: white;
    font-size: 14px;
    font-weight: 600;
  }
  .game-info { min-width: 0; }
  .game-header { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
  .game-title { font-size: 14px; font-weight: 500; color: var(--text); }
  .home-game .game-title { font-weight: 650; }
  .game-meta { color: var(--muted); font-size: 12px; margin-top: 1px; font-variant-numeric: tabular-nums; }
  .home-game .game-meta { color: var(--text); }
  .game-detail { color: var(--muted); font-size: 12px; line-height: 1.5; margin-top: 4px; }

  .location-badge {
    display: inline-flex;
    align-items: center;
    border-radius: var(--radius-sm);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.05em;
    line-height: 1;
    padding: 4px 6px;
    text-transform: uppercase;
  }
  .location-badge.home-location {
    background: rgba(88, 166, 255, 0.22);
    color: #a7d6ff;
  }
  .location-badge.away-location {
    background: rgba(255, 255, 255, 0.07);
    color: var(--muted);
  }

  .attendance-pill {
    background: rgba(69, 184, 121, 0.16);
    border-radius: var(--radius-sm);
    color: #76d49c;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.04em;
    line-height: 1;
    padding: 4px 6px;
    text-transform: uppercase;
  }
  .attendance-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 9px;
  }
  .attendance-btn {
    appearance: none;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: rgba(255, 255, 255, 0.03);
    color: var(--muted);
    cursor: pointer;
    font: inherit;
    font-size: 11px;
    font-weight: 600;
    padding: 5px 8px;
    transition: border-color 140ms var(--ease), background 140ms var(--ease), color 140ms var(--ease), opacity 140ms var(--ease);
  }
  .attendance-btn:hover:not(:disabled) {
    border-color: rgba(255, 255, 255, 0.22);
    color: var(--text);
  }
  .attendance-btn:disabled {
    cursor: default;
    opacity: 0.55;
  }
  .attendance-btn.attend.active {
    background: rgba(69, 184, 121, 0.16);
    border-color: rgba(69, 184, 121, 0.45);
    color: #76d49c;
  }
  .badge {
    display: inline-block; font-size: 10px; font-weight: 600;
    letter-spacing: 0.03em; text-transform: uppercase;
    padding: 1px 6px; border-radius: var(--radius-sm);
    margin-left: 4px; vertical-align: 1px;
  }
  .badge-season { background: rgba(255, 180, 50, 0.12); color: #f0b030; }
  .btn-sm { font-size: 12px; padding: 4px 10px; }

  @media (max-width: 640px) {
    .sports-header { align-items: flex-start; flex-direction: column; }
    .team-grid { grid-template-columns: 1fr; }
  }
</style>
