#!/usr/bin/env bash
#
# deploy.sh — Build & deploy CMS to the production server.
#
# Prerequisites on the server:
#   - Node.js >= 20, npm, PM2 (npm i -g pm2)
#   - Nginx installed and deploy/nginx/cms.conf linked
#   - PostgreSQL running, database & user created
#   - /opt/cms/{backend,frontend} directories owned by deploy user
#   - /data/cms-files directory created with proper permissions
#   - /var/log/cms directory created
#
# Usage:
#   ./scripts/deploy.sh              # deploy from local build
#   ./scripts/deploy.sh --skip-build # deploy pre-built artifacts

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────
APP_NAME="cms-backend"
DEPLOY_DIR="/opt/cms"
BACKEND_DIR="${DEPLOY_DIR}/backend"
FRONTEND_DIR="${DEPLOY_DIR}/frontend"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${DEPLOY_DIR}/releases"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
SKIP_BUILD=false

for arg in "$@"; do
    case "$arg" in
        --skip-build) SKIP_BUILD=true ;;
    esac
done

log() { echo "[$(date '+%H:%M:%S')] $*"; }
die() { log "ERROR: $*"; exit 1; }

# ── Pre-flight checks ────────────────────────────────────────
log "=== CMS Deployment — ${TIMESTAMP} ==="
command -v node >/dev/null  || die "node not found"
command -v npm  >/dev/null  || die "npm not found"
command -v pm2  >/dev/null  || die "pm2 not found (npm i -g pm2)"
command -v nginx >/dev/null || die "nginx not found"

[ -d "${DEPLOY_DIR}" ] || die "${DEPLOY_DIR} does not exist"
[ -f "${BACKEND_DIR}/.env" ] || die "${BACKEND_DIR}/.env not found — copy from deploy/.env.production.example"

# ── Step 1: Build ─────────────────────────────────────────────
if [ "${SKIP_BUILD}" = false ]; then
    log "Building frontend..."
    cd "${REPO_ROOT}/frontend"
    npm ci --ignore-scripts
    npm run build
    log "Frontend build complete."

    log "Building backend..."
    cd "${REPO_ROOT}/backend"
    npm ci --ignore-scripts
    npm run build
    log "Backend build complete."
fi

# ── Step 2: Create release snapshot ──────────────────────────
log "Creating release snapshot at ${BACKUP_DIR}/${TIMESTAMP}..."
mkdir -p "${BACKUP_DIR}/${TIMESTAMP}"
if [ -d "${BACKEND_DIR}/dist" ]; then
    cp -a "${BACKEND_DIR}/dist" "${BACKUP_DIR}/${TIMESTAMP}/backend-dist"
fi
if [ -d "${FRONTEND_DIR}/dist" ]; then
    cp -a "${FRONTEND_DIR}/dist" "${BACKUP_DIR}/${TIMESTAMP}/frontend-dist"
fi

# Keep only the 5 most recent release snapshots
cd "${BACKUP_DIR}" && ls -dt */ 2>/dev/null | tail -n +6 | xargs rm -rf -- 2>/dev/null || true

# ── Step 3: Deploy backend ───────────────────────────────────
log "Deploying backend..."
rsync -a --delete \
    "${REPO_ROOT}/backend/dist/" "${BACKEND_DIR}/dist/"
rsync -a \
    "${REPO_ROOT}/backend/package.json" \
    "${REPO_ROOT}/backend/package-lock.json" \
    "${BACKEND_DIR}/"
cd "${BACKEND_DIR}" && npm ci --omit=dev --ignore-scripts
log "Backend files deployed."

# ── Step 4: Run database migrations ──────────────────────────
log "Running database migrations..."
cd "${BACKEND_DIR}"
node -e "
const { DataSource } = require('typeorm');
const path = require('path');
const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'jimusho_cms',
    migrations: [path.join(__dirname, 'dist/migrations/*.js')],
    migrationsRun: true,
});
ds.initialize()
    .then(() => { console.log('Migrations complete'); return ds.destroy(); })
    .catch(e => { console.error(e); process.exit(1); });
" || die "Migration failed — consider rollback"
log "Migrations complete."

# ── Step 5: Deploy frontend ──────────────────────────────────
log "Deploying frontend..."
mkdir -p "${FRONTEND_DIR}"
rsync -a --delete \
    "${REPO_ROOT}/frontend/dist/" "${FRONTEND_DIR}/dist/"
log "Frontend files deployed."

# ── Step 6: Reload services ──────────────────────────────────
log "Reloading backend via PM2..."
if pm2 describe "${APP_NAME}" &>/dev/null; then
    pm2 reload "${APP_NAME}" --update-env
else
    pm2 start "${REPO_ROOT}/deploy/ecosystem.config.cjs" --env production
fi
pm2 save
log "PM2 reloaded."

log "Testing Nginx configuration..."
nginx -t || die "Nginx config test failed"
log "Reloading Nginx..."
sudo nginx -s reload
log "Nginx reloaded."

# ── Step 7: Health check ─────────────────────────────────────
log "Running health check..."
sleep 3
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/api/v1/health 2>/dev/null || echo "000")
if [ "${HTTP_STATUS}" = "200" ]; then
    log "Health check passed (HTTP ${HTTP_STATUS})."
else
    log "WARNING: Health check returned HTTP ${HTTP_STATUS}. Check logs: pm2 logs ${APP_NAME}"
fi

log "=== Deployment complete — ${TIMESTAMP} ==="
log "Release snapshot saved to ${BACKUP_DIR}/${TIMESTAMP}"
echo ""
echo "Post-deploy checklist:"
echo "  1. Verify the app at http://YOUR_SERVER_IP"
echo "  2. Check PM2 status: pm2 status"
echo "  3. Check PM2 logs:   pm2 logs ${APP_NAME} --lines 50"
echo "  4. Check Nginx logs:  tail -f /var/log/nginx/cms_error.log"
