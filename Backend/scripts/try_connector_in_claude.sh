#!/usr/bin/env bash
# Try the classmate connector inside Claude Code, against the LOCAL test server (never production).
#
# Prereq: the connector branch's backend is running on this Mac at http://localhost:8001
# (see OPS_RUNBOOK.md / ask Claude to start it). Uses the local seed test account by default;
# override with CM_EMAIL / CM_PASSWORD for another local test account.
#
# Usage:  bash Backend/scripts/try_connector_in_claude.sh        # connect
#         claude                                                 # then ask: "what's due this week?"
#         claude mcp remove classmate-local                      # when you're done
set -euo pipefail
BASE="${CM_BASE:-http://localhost:8001}"
EMAIL="${CM_EMAIL:-sim-tester@example.edu}"
PASSWORD="${CM_PASSWORD:-simulator-pass-123}"   # local seed password from Mobile/scripts/seed-local.py

case "$BASE" in http://localhost:*|http://127.0.0.1:*) ;; *) echo "Refusing: this script is for the local test server only."; exit 1;; esac

TOKEN=$(curl -sf -X POST "$BASE/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])') \
  || { echo "Couldn't sign in at $BASE. Is the local connector server running?"; exit 1; }

claude mcp remove classmate-local >/dev/null 2>&1 || true
claude mcp add --transport http classmate-local "$BASE/mcp" --header "Authorization: Bearer $TOKEN"
echo
echo "Connected. Run 'claude' and try:"
echo "  - What's due this week?"
echo "  - When is my next exam, and what should I review?"
echo "  - Quiz me on my PSYC 103 notes"
echo "  - Save a one-page study guide to my PSYC notes"
echo "The sign-in token expires after a while; just run this script again."
