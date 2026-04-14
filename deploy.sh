#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
LABEL="com.rohan.showtracker"

cd "$DIR"

echo "==> Installing deps"
bun install

echo "==> Building"
bun run build

echo "==> Restarting"
launchctl kickstart -k "gui/$(id -u)/${LABEL}" 2>/dev/null \
  || echo "    not installed — run ./install.sh first"

echo "==> Done"
