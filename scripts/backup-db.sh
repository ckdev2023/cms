#!/usr/bin/env bash
#
# backup-db.sh — Daily PostgreSQL full backup with 30-day retention.
#
# Crontab entry (run daily at 02:00):
#   0 2 * * * /opt/cms/scripts/backup-db.sh >> /var/log/cms/backup-db.log 2>&1
#
# Requires: pg_dump, gzip

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────
DB_NAME="${DB_NAME:-jimusho_cms}"
DB_USER="${DB_USER:-cms_app}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
BACKUP_ROOT="${BACKUP_ROOT:-/data/backups/db}"
RETENTION_DAYS=30
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_ROOT}/${DB_NAME}_${TIMESTAMP}.sql.gz"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# ── Pre-flight ────────────────────────────────────────────────
command -v pg_dump >/dev/null || { log "ERROR: pg_dump not found"; exit 1; }
mkdir -p "${BACKUP_ROOT}"

# ── Dump ──────────────────────────────────────────────────────
log "Starting database backup: ${DB_NAME} -> ${BACKUP_FILE}"

pg_dump \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    --format=custom \
    --compress=6 \
    --verbose \
    --file="${BACKUP_FILE%.gz}" \
    2>&1 | while IFS= read -r line; do log "  pg_dump: ${line}"; done

# Use custom format which is already compressed, rename accordingly
mv "${BACKUP_FILE%.gz}" "${BACKUP_FILE%.sql.gz}.dump"
BACKUP_FILE="${BACKUP_FILE%.sql.gz}.dump"

# ── Verify ────────────────────────────────────────────────────
if [ -s "${BACKUP_FILE}" ]; then
    SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
    log "Backup complete: ${BACKUP_FILE} (${SIZE})"
else
    log "ERROR: Backup file is empty or missing"
    exit 1
fi

# ── Rotation (keep last 30 days) ─────────────────────────────
log "Cleaning backups older than ${RETENTION_DAYS} days..."
DELETED=$(find "${BACKUP_ROOT}" -name "${DB_NAME}_*.dump" -mtime +${RETENTION_DAYS} -print -delete | wc -l)
log "Deleted ${DELETED} old backup(s)."

log "Database backup finished successfully."
