#!/usr/bin/env bash
#
# ai-gatekeeper.sh — AI 前置検査（Pre-flight Check）
#
# AI が新しいタスクを開始する前に実行し、以下を行う：
#   1. 必読ドキュメントの案内
#   2. 現在のプロジェクトフェーズの確認促進
#   3. 検証コマンドの推奨
#   4. 開始前チェックリストの提示
#
# 用法:
#   bash scripts/ai-gatekeeper.sh           # 標準モード
#   bash scripts/ai-gatekeeper.sh --brief   # 簡易出力（必読+コマンドのみ）
#
# 本スクリプトは状態ファイルに依存せず、単独実行可能。

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

BRIEF=false
for arg in "$@"; do
  case "$arg" in
    --brief) BRIEF=true ;;
  esac
done

# ── Colors ────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ── [1/4] Required reading ───────────────────────────────────

echo -e "${YELLOW}============================================================${NC}"
echo -e "${CYAN}${BOLD}🤖 AI GATEKEEPER: 前置検査${NC}"
echo -e "${YELLOW}============================================================${NC}"

echo -e "\n${CYAN}[1/4] 必読ドキュメント${NC}"
echo ""
echo -e "  ${BOLD}総入口（毎回確認）${NC}"
echo "    AGENTS.md"
echo ""
echo -e "  ${BOLD}第一層 — 背景・境界（初回必読）${NC}"
echo "    docs/事务所管理系统_需求分析与开发说明.md"
echo "    docs/01_总体架构与实施规划.md"
echo "    docs/04_技术选型与后端语言推荐.md"
echo ""
echo -e "  ${BOLD}第二層 — 実行規範（タスク前に適宜）${NC}"
echo "    docs/16_AI执行总入口与任务拆解.md"
echo "    docs/09_详细开发执行步骤.md"
echo "    docs/15_单人并行开发编排与依赖关系.md"
echo ""
echo -e "  ${BOLD}第四層 — コード規範・門禁${NC}"
echo "    docs/s05_style_rules.md"
echo "    docs/s06_jsdoc_standard.md"
echo "    docs/s07_jsdoc_gate_design.md"

# ── [2/4] Phase confirmation ─────────────────────────────────

echo -e "\n${CYAN}[2/4] 現在フェーズの確認${NC}"
echo ""
echo -e "  プロジェクトロードマップ（docs/16_AI执行总入口与任务拆解.md §4）:"
echo "    1. プロジェクト理解・スコープ凍結"
echo "    2. 技術スタック・実施境界確認"
echo "    3. 初期化・開発スケルトン"
echo "    4. DB・基本権限"
echo "    5. コア業務モジュール開発"
echo "    6. ファイル・財務・ダッシュボード・共通機能"
echo "    7. テスト・結合テスト・試運用"
echo "    8. デプロイ・バックアップ・本番準備"
echo ""
echo -e "  ${YELLOW}⚠️  タスク開始前に、現在のフェーズを確認してください。${NC}"

if [ "$BRIEF" = true ]; then
  echo -e "\n${CYAN}[3/4] 検証コマンド${NC}"
  echo ""
  echo "  npm run verify:fast   # 日常開発（lint + type-check + JSDoc）"
  echo "  npm run verify        # 機能完成（+ test）"
  echo "  npm run verify:full   # リリース前（+ build）"
  echo ""
  echo -e "${YELLOW}============================================================${NC}"
  exit 0
fi

# ── [3/4] Pre-task checklist ─────────────────────────────────

echo -e "\n${CYAN}[3/4] 開始前チェックリスト${NC}"
echo ""
echo "  □ 現在のフェーズを確認した"
echo "  □ 前提条件が完了済みである"
echo "  □ 今回変更するファイルを列挙した"
echo "  □ 他ブランチ・他ウィンドウとの競合がないか確認した"
echo "  □ 必要なドキュメントを読んだ"

# ── [4/4] Verification commands ──────────────────────────────

echo -e "\n${CYAN}[4/4] 検証コマンド（交付前に必ず実行）${NC}"
echo ""
echo -e "  ${GREEN}日常開発:${NC}"
echo "    npm run verify:fast"
echo "    → lint（前後端） + type-check（前後端） + JSDoc 質量検査"
echo ""
echo -e "  ${GREEN}機能完成:${NC}"
echo "    npm run verify"
echo "    → verify:fast + test（前後端）"
echo ""
echo -e "  ${GREEN}リリース・デプロイ前:${NC}"
echo "    npm run verify:full"
echo "    → verify + build（前後端）"
echo ""

# ── Detect environment issues ────────────────────────────────

ISSUES=0

if [ ! -f "${REPO_ROOT}/AGENTS.md" ]; then
  echo -e "  ${RED}✗ AGENTS.md が見つかりません${NC}"
  ISSUES=$((ISSUES + 1))
else
  echo -e "  ${GREEN}✓ AGENTS.md${NC}"
fi

if [ ! -f "${REPO_ROOT}/package.json" ]; then
  echo -e "  ${RED}✗ package.json が見つかりません${NC}"
  ISSUES=$((ISSUES + 1))
else
  if grep -q '"verify:fast"' "${REPO_ROOT}/package.json" 2>/dev/null; then
    echo -e "  ${GREEN}✓ verify:fast コマンドが定義済み${NC}"
  else
    echo -e "  ${RED}✗ verify:fast コマンドが未定義${NC}"
    ISSUES=$((ISSUES + 1))
  fi
fi

if [ ! -f "${REPO_ROOT}/scripts/check-jsdoc.mjs" ]; then
  echo -e "  ${YELLOW}△ scripts/check-jsdoc.mjs が見つかりません（JSDoc 質量検査が無効）${NC}"
  ISSUES=$((ISSUES + 1))
else
  echo -e "  ${GREEN}✓ JSDoc 質量検査スクリプト${NC}"
fi

if [ -f "${REPO_ROOT}/.husky/pre-commit" ]; then
  echo -e "  ${GREEN}✓ pre-commit フック（lint-staged）${NC}"
else
  echo -e "  ${YELLOW}△ pre-commit フックが未設定（npm install でセットアップ可能）${NC}"
fi

echo ""
if [ "$ISSUES" -gt 0 ]; then
  echo -e "${YELLOW}⚠️  ${ISSUES} 件の環境問題があります。先に解決してください。${NC}"
else
  echo -e "${GREEN}✓ 環境チェック OK${NC}"
fi

echo -e "\n${YELLOW}============================================================${NC}"
echo -e "${BOLD}タスクを開始してください。交付前に verify コマンドを忘れずに。${NC}"
echo -e "${YELLOW}============================================================${NC}"
