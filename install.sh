#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
LABEL="com.rohan.showtracker"
PLIST_DST="$HOME/Library/LaunchAgents/${LABEL}.plist"
REFRESH_LABEL="${LABEL}.refresh"
REFRESH_DST="$HOME/Library/LaunchAgents/${REFRESH_LABEL}.plist"
BUN="$(which bun)"

cd "$DIR"

# --- generate server plist ---
cat > "$PLIST_DST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>WorkingDirectory</key><string>${DIR}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${DIR}/start.sh</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PORT</key><string>63000</string>
    <key>HOST</key><string>0.0.0.0</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/tmp/showtracker.log</string>
  <key>StandardErrorPath</key><string>/tmp/showtracker.err</string>
</dict>
</plist>
EOF

echo "==> Installed $PLIST_DST"

# --- generate refresh cron plist ---
cat > "$REFRESH_DST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${REFRESH_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/curl</string>
    <string>-s</string>
    <string>-X</string>
    <string>POST</string>
    <string>http://localhost:63000/api/refresh</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key><integer>4</integer>
    <key>Minute</key><integer>0</integer>
  </dict>
  <key>StandardOutPath</key><string>/tmp/showtracker-refresh.log</string>
  <key>StandardErrorPath</key><string>/tmp/showtracker-refresh.err</string>
</dict>
</plist>
EOF

echo "==> Installed $REFRESH_DST"

# --- load both ---
launchctl unload "$PLIST_DST" 2>/dev/null || true
launchctl load "$PLIST_DST"
echo "==> Loaded $LABEL"

launchctl unload "$REFRESH_DST" 2>/dev/null || true
launchctl load "$REFRESH_DST"
echo "==> Loaded $REFRESH_LABEL"

echo "==> Done"
