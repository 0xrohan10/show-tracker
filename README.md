# show-tracker

personal tv release calendar. searches TMDB, pulls episode schedules from tvmaze, auto-resolves canadian streaming services. sqlite on disk. runs on a mac studio, access via tailscale from anywhere.

## stack

- sveltekit 2 (bun adapter)
- better-sqlite3 — single file at `./data/shows.db`
- TMDB for search + show metadata + CA watch providers
- tvmaze for episode airdates/times (merged with TMDB for best coverage)
- lucide icons
- launchd for nightly refresh

no auth. if you want to gate it, put it behind tailscale serve.

## setup

```sh
cd show-tracker
bun install
```

`better-sqlite3` compiles native bindings — on apple silicon this just works, but if it yells about python or gyp, `xcode-select --install` usually fixes it.

you need a TMDB API key (free, register at themoviedb.org). add it to `.env`:

```sh
echo 'TMDB_API_KEY="your_key_here"' > .env
```

## running it

dev mode (hot reload):

```sh
bun run dev
```

prod build + run:

```sh
bun run build
PORT=3000 bun build/index.js
```

### running permanently

**launchd** — drop this at `~/Library/LaunchAgents/com.rohan.showtracker.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.rohan.showtracker</string>
  <key>WorkingDirectory</key><string>/Users/rohan/Developer/personal/show-tracker</string>
  <key>ProgramArguments</key>
  <array>
    <string>/Users/rohan/.asdf/shims/bun</string>
    <string>build/index.js</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PORT</key><string>3000</string>
    <key>HOST</key><string>0.0.0.0</string>
    <key>DB_PATH</key><string>/Users/rohan/Developer/personal/show-tracker/data/shows.db</string>
    <key>TMDB_API_KEY</key><string>your_key_here</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/tmp/showtracker.log</string>
  <key>StandardErrorPath</key><string>/tmp/showtracker.err</string>
</dict>
</plist>
```

then:

```sh
launchctl load ~/Library/LaunchAgents/com.rohan.showtracker.plist
```

fix the bun path — `which bun` tells you. if you use asdf it's `~/.asdf/shims/bun`.

### nightly refresh

there's a plist at the repo root (`com.rohan.showtracker.refresh.plist`) that curls the refresh endpoint at 4am daily. copy it to `~/Library/LaunchAgents/` and `launchctl load` it.

you also have a manual refresh button in the ui.

## accessing from elsewhere

tailscale. `tailscale serve` or just hit `http://<studio-tailnet-name>:3000` from your laptop. done.

## how it works

1. search bar on dashboard → TMDB search, filtered by country (defaults to US & Canada)
2. click track → fetches show details from TMDB, resolves tvmaze ID via IMDB, pulls CA watch provider (Crave, Disney+, etc.), fetches episodes from both sources and merges them
3. dashboard groups upcoming episodes by airdate with service logos, finale badges, airtimes normalized to local 12h
4. show detail page (`/show/[id]`) shows all episodes in a card grid grouped by season
5. nightly cron re-fetches episodes for all tracked shows

tvmaze rate limit is 20 req / 10s — the refresh sleeps 250ms between shows. TMDB rate limit is ~40 req/s, not a concern.

## env vars

| var | default | description |
|-----|---------|-------------|
| `TMDB_API_KEY` | (required) | free key from themoviedb.org |
| `DB_PATH` | `./data/shows.db` | sqlite database path |
| `PORT` | `3000` | server port |
| `HOST` | `localhost` | bind address |

## files

```
src/
├── app.css, app.html
├── lib/
│   ├── format.js              # airtime normalization (ET → local 12h)
│   └── server/
│       ├── db.js              # sqlite schema + prepared statements + migrations
│       ├── tmdb.js            # TMDB api client (search, shows, episodes, watch providers)
│       ├── tvmaze.js          # tvmaze api client (search, shows, episodes)
│       └── refresh.js         # track + refresh logic, dual-source merge
└── routes/
    ├── +layout.svelte
    ├── +page.svelte           # dashboard: search, upcoming episodes, tracked shows
    ├── +page.server.js
    ├── show/[id]/             # show detail with episode card grid
    └── api/refresh/           # cron endpoint
```
