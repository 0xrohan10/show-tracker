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

## first-time setup (on the studio)

```sh
git clone git@github.com:0xrohan10/show-tracker.git
cd show-tracker
```

create `.env` with your TMDB API key (free, register at themoviedb.org):

```sh
echo 'TMDB_API_KEY="your_key_here"' > .env
```

install, build, and verify:

```sh
bun install
bun run build
PORT=63000 bun build/index.js
# ctrl+c once you've confirmed it works
```

### set up launchd (runs on boot, restarts on crash)

create the app plist — **update the bun path** (`which bun`) and **TMDB key**:

```sh
cat > ~/Library/LaunchAgents/com.rohan.showtracker.plist << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.rohan.showtracker</string>
  <key>WorkingDirectory</key><string>/Users/rohan/Developer/projects/show-tracker</string>
  <key>ProgramArguments</key>
  <array>
    <string>/Users/rohan/.bun/bin/bun</string>
    <string>build/index.js</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PORT</key><string>63000</string>
    <key>HOST</key><string>0.0.0.0</string>
    <key>DB_PATH</key><string>/Users/rohan/Developer/projects/show-tracker/data/shows.db</string>
    <key>TMDB_API_KEY</key><string>YOUR_KEY_HERE</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/tmp/showtracker.log</string>
  <key>StandardErrorPath</key><string>/tmp/showtracker.err</string>
</dict>
</plist>
PLIST
```

set up the nightly refresh (4am, curls the refresh endpoint):

```sh
cp com.rohan.showtracker.refresh.plist ~/Library/LaunchAgents/
```

load both:

```sh
launchctl load ~/Library/LaunchAgents/com.rohan.showtracker.plist
launchctl load ~/Library/LaunchAgents/com.rohan.showtracker.refresh.plist
```

verify:

```sh
curl -s http://localhost:63000/ | head -1
# should return <!DOCTYPE html>
```

## updating (redeploy)

```sh
cd ~/Developer/projects/show-tracker
git pull
bun install
bun run build
launchctl kickstart -k gui/$(id -u)/com.rohan.showtracker
```

that's it — `kickstart -k` kills the running process, launchd restarts it immediately with the new build.

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

**important:** launchd doesn't read `.env` — env vars for prod must be in the plist. if you change `TMDB_API_KEY` or add new env vars, update the plist and reload.

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
