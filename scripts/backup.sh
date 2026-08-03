#!/usr/bin/env bash
set -euo pipefail

# backup.sh — Phase 4 placeholder.
# Full implementation coming in Phase 4 (Backup and Recovery).
# See hive-ops/standards/08-backups.md for the intended design.
#
# When implemented, this script will:
#   1. Stop or quiesce the app (optional, depending on database type)
#   2. Tar and compress /home/deploy/$APP_NAME/data/ + .env + docker-compose.yml
#   3. Encrypt the archive if it will leave the LAN
#   4. Push to the configured external backup target
#   5. Apply retention policy (delete old backups)

echo "Backups not yet configured. See hive-ops/standards/08-backups.md (Phase 4)."
exit 0
