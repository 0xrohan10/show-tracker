<script lang="ts">
  import { ArrowLeft } from 'lucide-svelte';
  import type { PageData } from './$types';
  import type { EpisodeRow } from '$lib/server/db';

  export let data: PageData;

  const { show, seasons } = data;
  const lastSeasonNum = seasons.length > 0 ? seasons[seasons.length - 1].num : 0;
  const isEnded = /ended/i.test(show.status || '');

  type Season = typeof seasons[number];

  function finaleType(ep: EpisodeRow, season: Season): 'series' | 'season' | null {
    const isLastInSeason = ep === season.episodes[season.episodes.length - 1];
    if (!isLastInSeason) return null;
    return (season.num === lastSeasonNum && isEnded) ? 'series' : 'season';
  }

  function shortDate(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function isPast(iso: string | null): boolean {
    if (!iso) return false;
    const d = new Date(iso + 'T00:00:00');
    const today = new Date(); today.setHours(0,0,0,0);
    return d < today;
  }
</script>

<a href="/" class="back-link"><ArrowLeft size={14} /> back</a>

<div class="show-header">
  {#if show.image}<img src={show.image} alt="" class="show-poster" />{/if}
  <div class="show-info">
    <h2>{show.name}</h2>
    <div class="show-meta">
      {#if show.watching_on_logo}
        <img src={show.watching_on_logo} alt={show.watching_on || ''} class="service-logo" title={show.watching_on || ''} />
      {:else if show.watching_on || show.network}
        <span class="tag">{show.watching_on || show.network}</span>
      {/if}
      {#if show.status}<span class="status-tag">{show.status}</span>{/if}
    </div>
    {#if show.summary}
      <p class="show-summary">{show.summary}</p>
    {/if}
  </div>
</div>

{#each seasons as season}
  <section class="season">
    <h3 class="season-header">Season {season.num}</h3>
    <div class="ep-grid">
      {#each season.episodes as ep, i}
        <div class="ep-card stagger-in" style="animation-delay: {i * 40}ms" class:aired={isPast(ep.airdate)}>
          {#if ep.image}
            <img src={ep.image} alt="" class="ep-img" />
          {:else}
            <div class="ep-img-placeholder"></div>
          {/if}
          <div class="ep-body">
            <div class="ep-num mono">E{String(ep.number).padStart(2, '0')}</div>
            <div class="ep-name">
              {ep.name || 'TBA'}
              {#if finaleType(ep, season) === 'series'}<span class="badge badge-series">series finale</span>
              {:else if finaleType(ep, season) === 'season'}<span class="badge badge-season">season finale</span>
              {/if}
            </div>
            {#if ep.airdate}<div class="ep-date">{shortDate(ep.airdate)}</div>{/if}
            {#if ep.summary}<div class="ep-summary">{ep.summary.length > 120 ? ep.summary.slice(0, 120) + '…' : ep.summary}</div>{/if}
          </div>
        </div>
      {/each}
    </div>
  </section>
{/each}

<style>
  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--muted);
    font-size: 13px;
    margin-bottom: 20px;
    transition: color 150ms var(--ease);
  }
  .back-link:hover { color: var(--text); }

  .show-header {
    display: flex;
    gap: 20px;
    margin-bottom: 32px;
  }
  .show-poster {
    width: 120px;
    height: auto;
    border-radius: var(--radius-lg);
    flex-shrink: 0;
    object-fit: cover;
  }
  .show-info { flex: 1; min-width: 0; }
  .show-info h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    letter-spacing: -0.02em;
  }
  .show-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
  }
  .service-logo { width: 20px; height: 20px; border-radius: 4px; }
  .status-tag { color: var(--muted); font-size: 12px; }
  .show-summary {
    color: var(--secondary);
    font-size: 13px;
    line-height: 1.6;
    margin: 12px 0 0;
  }

  .season { margin-bottom: 28px; }
  .season-header {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
    margin: 0 0 8px;
  }

  .aired { opacity: 1; }

  .ep-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 10px;
  }
  .ep-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    transition: transform 200ms var(--ease-out), border-color 200ms var(--ease-out);
  }
  .ep-card:hover {
    transform: translateY(-2px);
    border-color: var(--border-active);
  }
  .ep-img {
    width: 100%;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    display: block;
    background: var(--faint);
  }
  .ep-img-placeholder {
    width: 100%;
    aspect-ratio: 16 / 9;
    background: var(--faint);
  }
  .ep-body { padding: 10px 12px 12px; }
  .ep-num {
    font-size: 11px;
    color: var(--muted);
    margin-bottom: 2px;
  }
  .ep-name {
    font-size: 14px;
    font-weight: 500;
    line-height: 1.3;
  }
  .ep-date {
    font-size: 12px;
    color: var(--muted);
    margin-top: 4px;
  }
  .ep-summary {
    font-size: 12px;
    color: var(--muted);
    line-height: 1.5;
    margin-top: 6px;
  }

  .badge {
    display: inline-block;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    padding: 1px 6px;
    border-radius: var(--radius-sm);
    margin-left: 4px;
    vertical-align: 1px;
  }
  .badge-season {
    background: rgba(255, 180, 50, 0.12);
    color: #f0b030;
  }
  .badge-series {
    background: var(--accent-subtle);
    color: var(--accent);
  }
</style>
