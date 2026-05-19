#!/usr/bin/env bash
set -euo pipefail

# Copy to ~/.hermes/scripts/arss-heartbeat.sh and chmod +x.
# Hermes no-agent cron rule:
# - empty stdout = silent tick
# - non-zero exit = alert
# This script only prints high-signal items or errors.

WORKDIR="${ARSS_WORKDIR:-$HOME/arss}"
cd "$WORKDIR"

OUT="$(npm run --silent arss:heartbeat -- --format json --min-interval-min "${ARSS_MIN_INTERVAL_MIN:-60}" --limit "${ARSS_LIMIT:-5}")"

HIGH_SIGNAL_COUNT="$(printf '%s' "$OUT" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); const n=(j.injections||[]).filter(i=>(i.relevance||0)>=Number(process.env.ARSS_ALERT_THRESHOLD||0.6)).length; console.log(n)})')"

if [ "$HIGH_SIGNAL_COUNT" -gt 0 ]; then
  printf '%s' "$OUT" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); const items=(j.injections||[]).filter(i=>(i.relevance||0)>=Number(process.env.ARSS_ALERT_THRESHOLD||0.6)); if(!items.length) process.exit(0); console.log("ARSS high-signal context:"); for (const item of items) console.log(`- ${item.title}\n  ${item.url}\n  relevance=${item.relevance}`);})'
fi
