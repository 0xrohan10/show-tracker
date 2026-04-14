<script>
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import { navigating } from '$app/stores';
  import { formatAirtime } from '$lib/format.js';
  import { RefreshCw, Search, Trash2, Loader2 } from 'lucide-svelte';
  export let data;
  export let form;

  function formatDate(iso) {
    if (!iso || iso === 'tba') return 'TBA';
    const d = new Date(iso + 'T00:00:00');
    const today = new Date(); today.setHours(0,0,0,0);
    const tmrw = new Date(today); tmrw.setDate(today.getDate()+1);
    const yest = new Date(today); yest.setDate(today.getDate()-1);
    if (d.getTime() === yest.getTime()) return 'Yesterday';
    if (d.getTime() === today.getTime()) return 'Today';
    if (d.getTime() === tmrw.getTime()) return 'Tomorrow';
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  }

  let query = data.q || '';
  let country = data.country || 'US,CA';
  let timer;
  let refreshing = false;
  let refreshingShow = null;
  let untracking = null;
  let tracking = null;

  const countries = [
    { value: 'US,CA', label: 'US & Canada' },
    { value: 'US', label: 'US' },
    { value: 'CA', label: 'Canada' },
    { value: 'GB', label: 'UK' },
    { value: 'AU', label: 'Australia' },
    { value: 'all', label: 'All countries' },
  ];

  function navigate() {
    if (!query.trim()) {
      goto('/', { replaceState: true, noScroll: true, keepFocus: true });
      return;
    }
    const params = new URLSearchParams({ q: query.trim(), country });
    goto(`/?${params}`, { replaceState: true, noScroll: true, keepFocus: true });
  }

  function onInput(e) {
    query = e.target.value;
    clearTimeout(timer);
    timer = setTimeout(navigate, 350);
  }

  function onCountryChange(e) {
    country = e.target.value;
    if (query.trim()) navigate();
  }

  $: if (data.q !== undefined) query = data.q || '';
  $: if (data.country !== undefined) country = data.country || 'US,CA';
  $: searching = query.trim().length > 0;
  $: searchLoading = searching && $navigating;
</script>

<!-- Search bar -->
<div class="search-row">
  <div class="search-field">
    <input
      type="search"
      placeholder="Search shows to track…"
      value={query}
      on:input={onInput}
    />
    {#if searchLoading}
      <div class="search-spinner"><Loader2 size={16} /></div>
    {/if}
  </div>
  {#if searching}
    <select class="country-select" value={country} on:change={onCountryChange}>
      {#each countries as c}
        <option value={c.value}>{c.label}</option>
      {/each}
    </select>
  {/if}
  {#if !searching}
    <form method="POST" action="?/refresh" use:enhance={() => {
      refreshing = true;
      return async ({ update }) => { await update(); refreshing = false; };
    }}>
      <button class="btn ghost" disabled={refreshing}>
        <span class:spin={refreshing}><RefreshCw size={14} /></span>
        {refreshing ? 'refreshing…' : 'refresh'}
      </button>
    </form>
  {/if}
</div>

{#if form?.error}
  <p class="error-msg">{form.error}</p>
{/if}

{#if form?.refreshed}
  <p class="refresh-notice">
    refreshed {form.refreshed.length} show{form.refreshed.length === 1 ? '' : 's'}
    {#if form.refreshed.some(r => !r.ok)}<span class="refresh-warn"> · some failed</span>{/if}
  </p>
{/if}

<!-- Search results -->
{#if searching}
  {#if data.searchError}
    <p class="error-msg">{data.searchError}</p>
  {/if}

  {#if data.q && data.results.length === 0 && !data.searchError && !searchLoading}
    <p class="muted no-results">no results{country !== 'all' ? ' in ' + countries.find(c => c.value === country)?.label : ''}</p>
  {/if}

  <div class="search-results" class:loading={searchLoading}>
    {#each data.results as r, i}
      <div class="search-result stagger-in" style="animation-delay: {i * 40}ms">
        <img src={r.image || ''} alt="" />
        <div class="result-info">
          <div class="result-name">{r.name}</div>
          <div class="result-meta">
            {r.network || 'unknown'} · {r.status || '—'}
            {#if r.premiered}<span class="mono"> · {r.premiered.slice(0,4)}</span>{/if}
          </div>
          {#if r.summary}
            <div class="result-summary">
              {r.summary.length > 160 ? r.summary.slice(0, 160) + '…' : r.summary}
            </div>
          {/if}
        </div>
        {#if data.tracked.has(r.tmdb_id)}
          <span class="tag">tracked</span>
        {:else}
          <form method="POST" action="?/track" use:enhance={() => {
            tracking = r.tmdb_id;
            return async ({ update }) => { await update(); tracking = null; };
          }}>
            <input type="hidden" name="tmdb_id" value={r.tmdb_id} />
            <button class="btn" disabled={tracking === r.tmdb_id}>
              {#if tracking === r.tmdb_id}
                <span class="spin"><Loader2 size={14} /></span>
              {:else}
                track
              {/if}
            </button>
          </form>
        {/if}
      </div>
    {/each}
  </div>
{/if}

<!-- Upcoming episodes -->
{#if !searching}
  {#if data.grouped.length === 0}
    <div class="empty">
      {#if data.shows.length === 0}
        <p>no shows tracked yet. search above to add one.</p>
      {:else}
        <p>no upcoming episodes. try hitting refresh.</p>
      {/if}
    </div>
  {:else}
    {#each data.grouped as group}
      <section class="date-group">
        <h2 class="date-label">{formatDate(group.date)}</h2>
        <div class="card ep-card">
          {#each group.episodes as ep}
            <div class="ep-row">
              <img src={ep.image || ep.show_image || ''} alt="" class="ep-thumb" />
              <div class="ep-info">
                <div class="ep-header">
                  <a href="/show/{ep.show_id}" class="ep-title">{ep.show_name}</a>
                  {#if ep.watching_on_logo}
                    <img src={ep.watching_on_logo} alt={ep.watching_on || ''} class="svc-logo" title={ep.watching_on || ''} />
                  {:else if ep.watching_on || ep.network}
                    <span class="tag">{ep.watching_on || ep.network}</span>
                  {/if}
                </div>
                <div class="ep-meta">
                  <span class="mono">S{String(ep.season).padStart(2,'0')}E{String(ep.number).padStart(2,'0')}</span>
                  {#if ep.name}<span class="sep">·</span> {ep.name}{/if}
                  {#if ep.airtime}<span class="sep">·</span> {formatAirtime(ep.airtime, ep.airdate)}{/if}
                  {#if ep.finale === 'series'}<span class="badge badge-series">series finale</span>
                  {:else if ep.finale === 'season'}<span class="badge badge-season">season finale</span>
                  {/if}
                </div>
                {#if ep.summary}
                  <div class="ep-summary">{ep.summary.length > 200 ? ep.summary.slice(0, 200) + '…' : ep.summary}</div>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </section>
    {/each}
  {/if}

  {#if data.shows.length > 0}
    <section class="tracked-section">
      <h2 class="section-header">Tracked ({data.shows.length})</h2>
      <div class="show-grid">
        {#each data.shows as s, i}
          <div class="card show-card stagger-in" style="animation-delay: {i * 30}ms" class:pending={refreshingShow === s.id || untracking === s.id}>
            <div class="show-card-top">
              {#if s.image}<img src={s.image} alt="" class="show-thumb" />{/if}
              <div class="show-card-info">
                <a href="/show/{s.id}" class="show-card-name">{s.name}</a>
                <div class="show-card-meta">
                  {#if s.watching_on_logo}
                    <img src={s.watching_on_logo} alt={s.watching_on || ''} class="service-logo-sm" title={s.watching_on || ''} />
                  {:else}
                    {s.watching_on || s.network || ''}
                  {/if}
                  {#if s.status}<span class="sep">·</span> {s.status}{/if}
                </div>
              </div>
            </div>
            <div class="show-card-actions">
              <form method="POST" action="?/refreshOne" use:enhance={() => {
                refreshingShow = s.id;
                return async ({ update }) => { await update(); refreshingShow = null; };
              }}>
                <input type="hidden" name="show_id" value={s.id} />
                <button class="btn ghost btn-sm" disabled={refreshingShow === s.id}>
                  <span class:spin={refreshingShow === s.id}><RefreshCw size={12} /></span>
                </button>
              </form>
              <form method="POST" action="?/untrack" use:enhance={() => {
                untracking = s.id;
                return async ({ update }) => { await update(); untracking = null; };
              }}>
                <input type="hidden" name="show_id" value={s.id} />
                <button class="btn danger btn-sm" disabled={untracking === s.id}>
                  {#if untracking === s.id}
                    <span class="spin"><Loader2 size={12} /></span>
                  {:else}
                    <Trash2 size={12} />
                  {/if}
                </button>
              </form>
            </div>
          </div>
        {/each}
      </div>
    </section>
  {/if}
{/if}

<style>
  /* Animations */
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .spin {
    display: inline-flex;
    animation: spin 0.6s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  }

  /* Search */
  .search-row {
    display: flex;
    gap: 8px;
    margin-bottom: 24px;
  }
  .search-field {
    flex: 1;
    position: relative;
  }
  .search-spinner {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--muted);
    display: flex;
    animation: spin 0.6s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  }

  .country-select {
    appearance: none;
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--secondary);
    padding: 8px 32px 8px 12px;
    border-radius: var(--radius);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: border-color 150ms var(--ease);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' viewBox='0 0 12 12'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%237a829a' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
  }
  .country-select:hover { border-color: var(--border-active); }
  .country-select:focus { outline: none; border-color: var(--accent); }

  .error-msg { color: var(--accent); font-size: 13px; margin: -12px 0 16px; }
  .no-results { margin-top: 0; }

  .search-results {
    transition: opacity 200ms var(--ease), filter 200ms var(--ease);
  }
  .search-results.loading {
    opacity: 0.4;
    filter: blur(1px);
  }

  .result-info { min-width: 0; }
  .result-name { font-size: 14px; font-weight: 500; }
  .result-meta { color: var(--muted); font-size: 12px; margin-top: 2px; }
  .result-summary { color: var(--muted); font-size: 12px; margin-top: 6px; line-height: 1.5; }

  /* Notices */
  .refresh-notice { color: var(--muted); font-size: 13px; margin: -16px 0 16px; }
  .refresh-warn { color: var(--accent); }

  /* Shared */
  .sep { color: var(--faint); margin: 0 1px; }
  .svc-logo { width: 18px; height: 18px; border-radius: 4px; flex-shrink: 0; }

  /* Upcoming */
  .date-group { margin-bottom: 24px; }
  .date-label {
    font-size: 11px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--muted); margin: 0 0 8px;
  }
  .ep-card { padding: 0 12px; }
  .ep-row {
    display: grid; grid-template-columns: 48px 1fr; gap: 12px;
    align-items: start; padding: 10px 0;
    border-bottom: 1px solid var(--border);
  }
  .ep-row:last-child { border-bottom: none; }
  .ep-thumb {
    width: 48px; height: 48px; object-fit: cover;
    border-radius: var(--radius-sm); background: var(--faint);
  }
  .ep-info { min-width: 0; }
  .ep-header { display: flex; align-items: center; gap: 8px; }
  .ep-title { font-size: 14px; font-weight: 500; color: var(--text); }
  .ep-title:hover { color: var(--accent); }
  .ep-meta { color: var(--muted); font-size: 12px; margin-top: 1px; font-variant-numeric: tabular-nums; }
  .ep-summary { color: var(--muted); font-size: 12px; line-height: 1.5; margin-top: 4px; }

  .badge {
    display: inline-block; font-size: 10px; font-weight: 600;
    letter-spacing: 0.03em; text-transform: uppercase;
    padding: 1px 6px; border-radius: var(--radius-sm);
    margin-left: 4px; vertical-align: 1px;
  }
  .badge-season { background: rgba(255, 180, 50, 0.12); color: #f0b030; }
  .badge-series { background: var(--accent-subtle); color: var(--accent); }

  /* Tracked */
  .service-logo-sm { width: 16px; height: 16px; border-radius: 3px; vertical-align: -2px; }
  .tracked-section { margin-top: 48px; }
  .show-card {
    padding: 12px;
    transition: opacity 200ms var(--ease), filter 200ms var(--ease);
  }
  .show-card.pending {
    opacity: 0.4;
    filter: blur(1px);
  }
  .show-card-top { display: flex; gap: 10px; align-items: flex-start; }
  .show-thumb {
    width: 44px; height: 62px; object-fit: cover;
    border-radius: var(--radius-sm); background: var(--faint); flex-shrink: 0;
  }
  .show-card-info { flex: 1; min-width: 0; }
  .show-card-name {
    display: block; font-size: 14px; font-weight: 500;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text);
  }
  .show-card-name:hover { color: var(--accent); }
  .show-card-meta { color: var(--muted); font-size: 12px; margin-top: 2px; }
  .show-card-actions {
    display: flex; gap: 4px; margin-top: 10px;
    padding-top: 10px; border-top: 1px solid var(--border);
  }
  .btn-sm { font-size: 12px; padding: 4px 10px; }
</style>
