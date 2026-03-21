#!/usr/bin/env bash
#
# backup-files.sh — Daily incremental file sync to NAS.
#
# Crontab entry (run daily at 03:00):
#   0 3 * * * /opt/cms/scripts/backup-files.sh >> /var/log/cms/backup-files.log 2>&1
#
# Requires: rsync

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────
FILE_SOURCE="${FILE_SOURCE:-/data/cms-files/}"
NAS_TARGET="${NAS_TARGET:-/mnt/nas/cms-backup/files/}"
LOG_DIR="/var/log/cms"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# ── Pre-flight ────────────────────────────────────────────────
command -v rsync >/dev/null || { log "ERROR: rsync not found"; exit 1; }

if [ ! -d "${FILE_SOURCE}" ]; then
    log "ERROR: Source directory ${FILE_SOURCE} does not exist"
    exit 1
fi

if [ ! -d "${NAS_TARGET}" ]; then
    log "ERROR: NAS target ${NAS_TARGET} is not mounted or does not exist"
    log "  Check NAS mount: mount | grep nas"
    exit 1
fi

mkdir -p "${LOG_DIR}"

# ── Sync ──────────────────────────────────────────────────────
log "Starting file sync: ${FILE_SOURCE} -> ${NAS_TARGET}"

rsync -avz \
    --delete \
    --stats \
    --log-file="${LOG_DIR}/rsync-files-${TIMESTAMP}.log" \
    "${FILE_SOURCE}" \
    "${NAS_TARGET}" \
    2>&1 | while IFS= read -r line; do log "  rsync: ${line}"; done

EXIT_CODE=${PIPESTATUS[0]}

if [ "${EXIT_CODE}" -eq 0 ]; then
    log "File sync completed successfully."
else
    log "ERROR: rsync exited with code ${EXIT_CODE}"
    exit "${EXIT_CODE}"
fi

# ── Cleanup old rsync logs (keep 30 days) ─────────────────────
find "${LOG_DIR}" -name "rsync-files-*.log" -mtime +30 -delete 2>/dev/null || true

log "File backup finished."
