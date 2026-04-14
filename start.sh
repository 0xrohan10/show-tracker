#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

# load env vars (.env is gitignored, keeps secrets out of the plist)
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

exec bun build/index.js
