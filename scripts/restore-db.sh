#!/usr/bin/env bash
#
# restore-db.sh — Restore a PostgreSQL backup and verify integrity.
#
# Usage:
#   ./scripts/restore-db.sh /data/backups/db/jimusho_cms_20260320_020000.dump
#   ./scripts/restore-db.sh /data/backups/db/jimusho_cms_20260320_020000.dump --target-db jimusho_cms_verify
#
# The default target database is "jimusho_cms_verify" to avoid overwriting production.

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────
DB_USER="${DB_USER:-cms_app}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
TARGET_DB="jimusho_cms_verify"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
die() { log "ERROR: $*"; exit 1; }

# ── Parse arguments ───────────────────────────────────────────
BACKUP_FILE=""
for arg in "$@"; do
    case "$arg" in
        --target-db)   shift; TARGET_DB="${1:-${TARGET_DB}}" ;;
        --target-db=*) TARGET_DB="${arg#*=}" ;;
        -*)            die "Unknown option: $arg" ;;
        *)             BACKUP_FILE="$arg" ;;
    esac
    shift 2>/dev/null || true
done

[ -n "${BACKUP_FILE}" ] || die "Usage: $0 <backup-file> [--target-db <name>]"
[ -f "${BACKUP_FILE}" ] || die "Backup file not found: ${BACKUP_FILE}"
command -v pg_restore >/dev/null || die "pg_restore not found"

log "=== Database Restore ==="
log "Backup file: ${BACKUP_FILE}"
log "Target DB:   ${TARGET_DB}"

# ── Safety check ──────────────────────────────────────────────
if [ "${TARGET_DB}" = "jimusho_cms" ]; then
    echo ""
    echo "  WARNING: You are about to overwrite the PRODUCTION database!"
    echo "  This will DROP and RECREATE '${TARGET_DB}'."
    echo ""
    read -rp "  Type 'yes-overwrite-production' to confirm: " CONFIRM
    [ "${CONFIRM}" = "yes-overwrite-production" ] || die "Aborted."
fi

# ── Step 1: Create/recreate target database ───────────────────
log "Dropping database '${TARGET_DB}' if it exists..."
dropdb -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" --if-exists "${TARGET_DB}" 2>/dev/null || true

log "Creating database '${TARGET_DB}'..."
createdb -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -O "${DB_USER}" "${TARGET_DB}"

# ── Step 2: Restore ──────────────────────────────────────────
log "Restoring from backup..."
pg_restore \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${TARGET_DB}" \
    --verbose \
    --no-owner \
    --no-acl \
    "${BACKUP_FILE}" \
    2>&1 | while IFS= read -r line; do log "  pg_restore: ${line}"; done

# ── Step 3: Verify ────────────────────────────────────────────
log "Verifying restored database..."

TABLE_COUNT=$(psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${TARGET_DB}" -tAc \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")
log "Tables found: ${TABLE_COUNT}"

if [ "${TABLE_COUNT}" -lt 10 ]; then
    die "Verification FAILED — expected at least 10 tables, found ${TABLE_COUNT}"
fi

CUSTOMER_COUNT=$(psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${TARGET_DB}" -tAc \
    "SELECT count(*) FROM customers;" 2>/dev/null || echo "N/A")
USER_COUNT=$(psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${TARGET_DB}" -tAc \
    "SELECT count(*) FROM users;" 2>/dev/null || echo "N/A")

log "Sample counts — users: ${USER_COUNT}, customers: ${CUSTOMER_COUNT}"

MIGRATION_COUNT=$(psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${TARGET_DB}" -tAc \
    "SELECT count(*) FROM migrations;" 2>/dev/null || echo "N/A")
log "Applied migrations: ${MIGRATION_COUNT}"

# ── Summary ───────────────────────────────────────────────────
log "=== Restore Verification PASSED ==="
log "Database '${TARGET_DB}' restored with ${TABLE_COUNT} tables."
echo ""
echo "Next steps:"
echo "  - Inspect data: psql -d ${TARGET_DB}"
echo "  - Drop verify DB when done: dropdb ${TARGET_DB}"
echo "  - To restore to production, re-run with: --target-db jimusho_cms"
