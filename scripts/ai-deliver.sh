#!/usr/bin/env bash
#
# ai-deliver.sh — AI / 人工共通の統一交付門禁スクリプト。
#
# verify:fast / verify / verify:full と同じチェックを、構造化された出力で実行する。
# 各チェックの合否を個別表示し、失敗原因を埋もれさせない。
#
# 使い方:
#   bash scripts/ai-deliver.sh              # fast モード（lint + type-check + jsdoc）
#   bash scripts/ai-deliver.sh --fast       # 同上
#   bash scripts/ai-deliver.sh --standard   # fast + test
#   bash scripts/ai-deliver.sh --full       # standard + build
#
# 終了コード:
#   0 — 全チェック合格
#   1 — 一つ以上のチェックが失敗

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# ── Mode selection ────────────────────────────────────────────
MODE="fast"
for arg in "$@"; do
  case "$arg" in
    --fast)     MODE="fast" ;;
    --standard) MODE="standard" ;;
    --full)     MODE="full" ;;
    --help|-h)
      echo "Usage: bash scripts/ai-deliver.sh [--fast|--standard|--full]"
      echo ""
      echo "  --fast      lint + type-check + JSDoc (default)"
      echo "  --standard  fast + tests"
      echo "  --full      standard + build"
      exit 0
      ;;
  esac
done

# ── Output helpers ────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0
FAILED_CHECKS=()
STEP=0

step_header() {
  STEP=$((STEP + 1))
  echo ""
  echo -e "${CYAN}━━━ [$STEP] $1 ━━━${NC}"
}

mark_pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  echo -e "  ${GREEN}✓${NC} $1"
}

mark_fail() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  FAILED_CHECKS+=("$1")
  echo -e "  ${RED}✗${NC} $1"
}

mark_warn() {
  WARN_COUNT=$((WARN_COUNT + 1))
  echo -e "  ${YELLOW}⚠${NC} $1"
}

run_check() {
  local label="$1"
  shift
  if "$@" ; then
    mark_pass "$label"
    return 0
  else
    mark_fail "$label"
    return 1
  fi
}

# ── Git context ───────────────────────────────────────────────
echo -e "${BOLD}🔍 [AI-Deliver] 交付前自動検査を実行中...${NC}"
echo -e "   モード: ${CYAN}${MODE}${NC}"

CHANGED_FILES=$(git diff --name-only --diff-filter=d HEAD 2>/dev/null || true)
if [ -n "$CHANGED_FILES" ]; then
  CHANGED_COUNT=$(echo "$CHANGED_FILES" | wc -l | tr -d ' ')
  echo -e "   変更ファイル: ${CHANGED_COUNT} 件"

  FE_COUNT=$(echo "$CHANGED_FILES" | grep -c '^frontend/' || true)
  BE_COUNT=$(echo "$CHANGED_FILES" | grep -c '^backend/' || true)
  OTHER_COUNT=$((CHANGED_COUNT - FE_COUNT - BE_COUNT))

  SCOPE=""
  [ "$FE_COUNT" -gt 0 ] && SCOPE="frontend($FE_COUNT)"
  [ "$BE_COUNT" -gt 0 ] && SCOPE="${SCOPE:+$SCOPE + }backend($BE_COUNT)"
  [ "$OTHER_COUNT" -gt 0 ] && SCOPE="${SCOPE:+$SCOPE + }other($OTHER_COUNT)"
  echo -e "   スコープ: ${SCOPE}"
else
  echo -e "   ${YELLOW}変更ファイルなし（git diff HEAD で検出ゼロ）${NC}"
fi
echo ""

# ── Phase 1: Code Style (lint) ────────────────────────────────
step_header "コードスタイル検査（ESLint）"

run_check "Frontend lint" npm run lint:frontend || true
run_check "Backend lint"  npm run lint:backend  || true

# ── Phase 2: Type Check ──────────────────────────────────────
step_header "型検査（TypeScript）"

run_check "Frontend type-check" npm run type-check:frontend || true
run_check "Backend type-check"  npm run type-check:backend  || true

# ── Phase 3: JSDoc Quality ────────────────────────────────────
step_header "JSDoc 品質検査"

run_check "JSDoc quality (Layer 2)" npm run jsdoc:check || true

# ── Phase 4: Tests (standard / full) ─────────────────────────
if [ "$MODE" = "standard" ] || [ "$MODE" = "full" ]; then
  step_header "テスト実行"

  run_check "Frontend tests (vitest)" npm run test:frontend || true
  run_check "Backend tests (jest)"    npm run test:backend  || true
fi

# ── Phase 5: Build (full only) ───────────────────────────────
if [ "$MODE" = "full" ]; then
  step_header "ビルド検証"

  run_check "Frontend build" npm run build:frontend || true
  run_check "Backend build"  npm run build:backend  || true
fi

# ── Summary ───────────────────────────────────────────────────
TOTAL=$((PASS_COUNT + FAIL_COUNT))
echo ""
echo -e "${BOLD}════════════════════════════════════════${NC}"
echo -e "${BOLD}  AI-Deliver 結果サマリー (${MODE})${NC}"
echo -e "${BOLD}════════════════════════════════════════${NC}"
echo -e "  合格: ${GREEN}${PASS_COUNT}${NC} / ${TOTAL}"
if [ "$WARN_COUNT" -gt 0 ]; then
  echo -e "  警告: ${YELLOW}${WARN_COUNT}${NC}"
fi

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo -e "  失敗: ${RED}${FAIL_COUNT}${NC}"
  echo ""
  echo -e "  ${RED}失敗した検査:${NC}"
  for fc in "${FAILED_CHECKS[@]}"; do
    echo -e "    ${RED}✗${NC} ${fc}"
  done
  echo ""
  echo -e "${RED}❌ [AI-Deliver] ${FAIL_COUNT} 件の検査に失敗。修正後に再実行してください。${NC}"
  exit 1
fi

echo ""
if [ "$WARN_COUNT" -gt 0 ]; then
  echo -e "${GREEN}✅ [AI-Deliver] 全検査合格（警告あり — 上記 ⚠ を確認してください）${NC}"
else
  echo -e "${GREEN}✅ [AI-Deliver] 全検査合格。交付可能です！${NC}"
fi
exit 0
