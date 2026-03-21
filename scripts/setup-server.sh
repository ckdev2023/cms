#!/usr/bin/env bash
#
# setup-server.sh — One-time production server setup.
#
# Run as root or with sudo on a fresh server.
# This script creates directories, sets permissions, and registers crontab entries.
#
# Usage:
#   sudo ./scripts/setup-server.sh

set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-$(whoami)}"

log() { echo "[$(date '+%H:%M:%S')] $*"; }

log "=== CMS Server Setup ==="
log "Deploy user: ${DEPLOY_USER}"

# ── Create directories ────────────────────────────────────────
log "Creating directories..."
dirs=(
    /opt/cms/backend
    /opt/cms/frontend
    /opt/cms/releases
    /opt/cms/scripts
    /data/cms-files/CUSTOMER
    /data/cms-files/ADMIN
    /data/cms-files/TAX
    /data/cms-files/FINANCE
    /data/cms-files/INTERNAL
    /data/backups/db
    /var/log/cms
)

for d in "${dirs[@]}"; do
    mkdir -p "$d"
    chown "${DEPLOY_USER}:${DEPLOY_USER}" "$d"
    log "  Created: $d"
done

# ── Copy scripts ──────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
log "Copying scripts to /opt/cms/scripts/..."
cp "${SCRIPT_DIR}/deploy.sh" /opt/cms/scripts/
cp "${SCRIPT_DIR}/backup-db.sh" /opt/cms/scripts/
cp "${SCRIPT_DIR}/backup-files.sh" /opt/cms/scripts/
cp "${SCRIPT_DIR}/restore-db.sh" /opt/cms/scripts/
chmod +x /opt/cms/scripts/*.sh
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" /opt/cms/scripts/

# ── Setup crontab ─────────────────────────────────────────────
log "Setting up crontab for ${DEPLOY_USER}..."
CRON_MARKER="# CMS-BACKUP-MANAGED"
EXISTING_CRON=$(crontab -u "${DEPLOY_USER}" -l 2>/dev/null || true)

if echo "${EXISTING_CRON}" | grep -q "${CRON_MARKER}"; then
    log "  Crontab entries already exist, skipping."
else
    (
        echo "${EXISTING_CRON}"
        echo ""
        echo "${CRON_MARKER}"
        echo "# DB backup — daily at 02:00"
        echo "0 2 * * * /opt/cms/scripts/backup-db.sh >> /var/log/cms/backup-db.log 2>&1"
        echo "# File backup — daily at 03:00"
        echo "0 3 * * * /opt/cms/scripts/backup-files.sh >> /var/log/cms/backup-files.log 2>&1"
    ) | crontab -u "${DEPLOY_USER}" -
    log "  Crontab entries added."
fi

# ── Summary ───────────────────────────────────────────────────
log "=== Setup complete ==="
echo ""
echo "Next steps:"
echo "  1. Copy deploy/.env.production.example to /opt/cms/backend/.env and edit values"
echo "  2. Create PostgreSQL user and database:"
echo "       sudo -u postgres createuser -P cms_app"
echo "       sudo -u postgres createdb -O cms_app jimusho_cms"
echo "  3. Link Nginx config:"
echo "       sudo cp deploy/nginx/cms.conf /etc/nginx/conf.d/cms.conf"
echo "       sudo nginx -t && sudo systemctl reload nginx"
echo "  4. Run the deployment:"
echo "       ./scripts/deploy.sh"
echo "  5. Follow the go-live checklist: docs/18_上線チェックリスト.md"
