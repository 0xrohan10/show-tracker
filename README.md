# show-tracker

personal tv release calendar. searches TMDB, pulls episode schedules from tvmaze, auto-resolves canadian streaming services. bun:sqlite on disk. runs on a mac studio, access via tailscale from anywhere.

## stack

- sveltekit 2 with svelte-adapter-bun
- bun:sqlite — single file at `./data/shows.db`, zero native dependencies
- TMDB for search + show metadata + CA watch providers
- tvmaze for episode airdates/times (merged with TMDB for best coverage)
- lucide icons
- launchd for process management + nightly refresh

no auth. if you want to gate it, put it behind tailscale serve.

## first-time setup

```sh
git clone git@github.com:0xrohan10/show-tracker.git
cd show-tracker
```

create `.env` with your TMDB API key (free, register at themoviedb.org):

```sh
echo 'TMDB_API_KEY="your_key_here"' > .env
```

**the API key lives in `.env`, never in the plist or any committed file.** the `start.sh` wrapper sources `.env` before launching the server, so launchd picks up the key without it being hardcoded anywhere.

install and build:

```sh
bun install
bun run build
```

### install launchd services

```sh
./install.sh
```

this generates two plists from the current directory and loads them:

- **`com.rohan.showtracker`** — runs the server on boot, restarts on crash
- **`com.rohan.showtracker.refresh`** — nightly 4am cron to refresh episode data

verify:

```sh
curl -s http://localhost:63000/ | head -1
# should return <!DOCTYPE html>
```

## updating (redeploy)

```sh
cd /path/to/show-tracker
git pull
./deploy.sh
```

`deploy.sh` installs deps, rebuilds, and kicks the launchd service to restart with the new build.

## troubleshooting

```sh
# check if the service is running (exit code 0 = running, nonzero = crashed)
launchctl list | grep showtracker

# check error logs
cat /tmp/showtracker.err
cat /tmp/showtracker.log

# manually start/stop
launchctl kickstart gui/$(id -u)/com.rohan.showtracker
launchctl kill SIGTERM gui/$(id -u)/com.rohan.showtracker

# full reload (unload + load)
launchctl unload ~/Library/LaunchAgents/com.rohan.showtracker.plist
launchctl load ~/Library/LaunchAgents/com.rohan.showtracker.plist

# test the refresh endpoint
curl -s -X POST http://localhost:63000/api/refresh | python3 -m json.tool

# peek at the db
sqlite3 data/shows.db "SELECT name, watching_on FROM shows;"
```

## developing locally

```sh
bun run dev
```

hot reloads on save. `.env` is read automatically by vite in dev mode. the dev server port is assigned by vite (usually 5173).

## accessing from elsewhere

tailscale. hit `http://<studio-tailnet-name>:63000` from any device on your tailnet.

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
| `PORT` | `63000` | server port |
| `HOST` | `localhost` | bind address (`0.0.0.0` for tailscale) |

## scripts

| script | purpose |
|--------|---------|
| `install.sh` | generates launchd plists from pwd, loads them — run once |
| `deploy.sh` | `bun install` + `bun run build` + restart service — run after pulling |
| `start.sh` | wrapper that sources `.env` and runs bun — called by launchd |

## files

```
src/
├── app.css, app.html
├── lib/
│   ├── format.js              # airtime normalization (ET → local 12h)
│   └── server/
│       ├── db.js              # bun:sqlite schema + prepared statements + migrations
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

## nuke and start over

```sh
rm -rf data/ .svelte-kit build
bun run build
launchctl kickstart -k gui/$(id -u)/com.rohan.showtracker
```
