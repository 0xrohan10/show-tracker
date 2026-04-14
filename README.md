# show-tracker

personal release calendar for tv shows. uses tvmaze's api (free, no key). sqlite on disk. runs on your mac studio, access via tailscale from anywhere.

## stack

- sveltekit (node adapter)
- better-sqlite3 — single file at `./data/shows.db`
- tvmaze api for show + episode data
- launchd for nightly refresh

no auth. if you want to gate it behind something, stick it behind tailscale serve / caddy with basic auth. running on localhost means only you on the network can hit it anyway.

## setup

```sh
cd show-tracker
npm install
npm run build
```

`better-sqlite3` compiles native bindings — on apple silicon this just works, but if it yells at you about python or gyp, `xcode-select --install` usually fixes it.

## running it

dev mode (hot reload on port 5173):

```sh
npm run dev
```

prod mode (port 3000):

```sh
PORT=3000 node build
```

you probably want this running permanently. options in order of how much you'll actually do them:

**tmux + autostart on boot**. simplest. wrap `node build` in a tmux session, add a launchd plist that starts it on login.

**pm2**. `npm i -g pm2`, `pm2 start build/index.js --name tracker`, `pm2 save`, `pm2 startup` — it writes the launchd plist for you.

**docker**. overkill for one process with a sqlite file but whatever floats the boat.

### launchd for the app itself

drop this at `~/Library/LaunchAgents/com.rohan.showtracker.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.rohan.showtracker</string>
  <key>WorkingDirectory</key><string>/Users/rohan/code/show-tracker</string>
  <key>ProgramArguments</key>
  <array>
    <string>/Users/rohan/.asdf/shims/node</string>
    <string>build/index.js</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PORT</key><string>3000</string>
    <key>HOST</key><string>0.0.0.0</string>
    <key>DB_PATH</key><string>/Users/rohan/code/show-tracker/data/shows.db</string>
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

fix the node path — if you use asdf, `which node` tells you. if you use homebrew node, it's `/opt/homebrew/bin/node`.

### nightly refresh

there's a plist at the repo root (`com.rohan.showtracker.refresh.plist`) that curls the refresh endpoint at 4am daily. copy it to `~/Library/LaunchAgents/` and `launchctl load` it. that's it.

you also have a manual refresh button in the ui for when you just added a show and want episodes now.

## accessing from elsewhere

tailscale. `tailscale serve` or just hit `http://<studio-tailnet-name>:3000` from your macbook. done.

## how it works

1. search `/add` → tvmaze `/search/shows?q=...`
2. click track → fetches full episode list, upserts everything into sqlite
3. dashboard groups episodes by airdate, `>=` today only
4. nightly cron re-fetches episodes for all tracked shows (handles mid-season schedule changes, new seasons, etc.)

tvmaze rate limit is 20 req / 10s — the refresh job sleeps 250ms between shows to stay way under.

## adding features later

- "watched" tracking — add `watched_at` column on episodes, strike through in ui
- notifications — when refresh finds a new episode landing within 24h, fire a webhook to ntfy/pushover/whatever
- multi-user — add a users table, session cookies, do it when you feel like it
- streaming service filter — tvmaze gives you `webChannel.name`, already stored in `network`, just add a filter pill row

## files

```
src/
├── app.css, app.html
├── lib/server/
│   ├── db.js          # sqlite schema + prepared statements
│   ├── tvmaze.js      # api client
│   └── refresh.js     # fetch show + episodes, upsert
└── routes/
    ├── +layout.svelte
    ├── +page.svelte          # dashboard
    ├── +page.server.js
    ├── add/                  # search + track new shows
    └── api/refresh/          # cron hits this
```
