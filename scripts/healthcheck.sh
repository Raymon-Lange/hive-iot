#!/usr/bin/env bash
set -euo pipefail

# healthcheck.sh — check health of all containers belonging to an app.
# Run from the app's directory:
#   bash scripts/healthcheck.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

ENV_FILE="$APP_DIR/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: .env not found at $ENV_FILE"
  exit 1
fi
# shellcheck disable=SC1090
source "$ENV_FILE"

APP_NAME="${APP_NAME:?APP_NAME must be set in .env}"

echo "==> Health status for $APP_NAME"
echo ""

EXIT_CODE=0

# Get all containers matching the app name prefix
CONTAINERS=$(docker ps --filter "name=^${APP_NAME}-" --format "{{.Names}}")

if [[ -z "$CONTAINERS" ]]; then
  echo "WARNING: No running containers found with prefix '${APP_NAME}-'"
  echo "Run 'bash scripts/deploy.sh' to start the app."
  exit 1
fi

while IFS= read -r container; do
  HEALTH=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container" 2>/dev/null || echo "unknown")
  STATUS=$(docker inspect --format='{{.State.Status}}' "$container" 2>/dev/null || echo "unknown")

  if [[ "$HEALTH" == "unhealthy" || "$STATUS" == "restarting" || "$STATUS" == "exited" ]]; then
    printf "  FAIL  %-40s  status=%-12s  health=%s\n" "$container" "$STATUS" "$HEALTH"
    EXIT_CODE=1
  else
    printf "  OK    %-40s  status=%-12s  health=%s\n" "$container" "$STATUS" "$HEALTH"
  fi
done <<< "$CONTAINERS"

echo ""
if [[ "$EXIT_CODE" -eq 0 ]]; then
  echo "All containers healthy."
else
  echo "One or more containers are unhealthy. Check logs:"
  echo "  docker compose logs --tail 50"
fi

exit "$EXIT_CODE"
