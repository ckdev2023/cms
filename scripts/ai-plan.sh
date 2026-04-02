#!/usr/bin/env bash
#
# scripts/ai-plan.sh — AI 规划阶段辅助脚本
#
# 根据变更文件数、目录跨度、是否跨前后端自动计算 S/M/L 建议级别，
# 与 AI 声明级别对比，不匹配时输出警告。
# 本脚本为轻量版闸门，不产生状态文件或物理阻断。
#
# 用法:
#   bash scripts/ai-plan.sh              # 自动分析 git diff，无声明级别
#   bash scripts/ai-plan.sh S            # 声明 S 级，脚本验证是否合理
#   bash scripts/ai-plan.sh M            # 声明 M 级
#   bash scripts/ai-plan.sh -- f1.ts f2.vue  # 显式指定文件列表
#   bash scripts/ai-plan.sh S -- f1.ts       # 声明 S 级 + 显式文件列表

set -euo pipefail

# ── 颜色定义 ──────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# ── 参数解析 ──────────────────────────────────────────────────────────
DECLARED_LEVEL=""
EXPLICIT_FILES=()
FOUND_SEPARATOR=false

for arg in "$@"; do
  if [ "$FOUND_SEPARATOR" = true ]; then
    EXPLICIT_FILES+=("$arg")
  elif [ "$arg" = "--" ]; then
    FOUND_SEPARATOR=true
  elif [[ "$arg" =~ ^[SsMmLl]$ ]] && [ -z "$DECLARED_LEVEL" ]; then
    DECLARED_LEVEL=$(echo "$arg" | tr '[:lower:]' '[:upper:]')
  fi
done

# ── 文件列表获取 ──────────────────────────────────────────────────────

collect_files() {
  if [ "${#EXPLICIT_FILES[@]}" -gt 0 ]; then
    printf '%s\n' "${EXPLICIT_FILES[@]}"
    return
  fi

  cd "$REPO_ROOT"
  {
    git diff --name-only --diff-filter=d HEAD 2>/dev/null || true
    git diff --name-only --cached --diff-filter=d 2>/dev/null || true
    git ls-files --others --exclude-standard 2>/dev/null || true
  } | sort -u | grep -v '^\s*$' || true
}

FILES=$(collect_files)
FILE_COUNT=$(echo "$FILES" | grep -c '.' 2>/dev/null || echo 0)

# ── 影响面分析 ────────────────────────────────────────────────────────

HAS_FRONTEND=false
HAS_BACKEND=false
HAS_ROOT=false
HAS_DOCS=false
HAS_SCRIPTS=false
HAS_PUBLIC_INFRA=false

FE_MODULES=()
BE_MODULES=()
FE_MODULE_COUNT=0
BE_MODULE_COUNT=0

PUBLIC_INFRA_PATTERNS=(
  "frontend/src/layouts/"
  "frontend/src/styles/"
  "frontend/src/router"
  "frontend/src/stores/"
  "frontend/src/composables/"
  "frontend/src/components/"
  "backend/src/common/"
  "backend/src/app.module"
  "backend/src/main.ts"
)

analyze_files() {
  local seen_fe_mods=""
  local seen_be_mods=""

  while IFS= read -r f; do
    [ -z "$f" ] && continue

    if [[ "$f" == frontend/* ]]; then
      HAS_FRONTEND=true

      if [[ "$f" == frontend/src/views/* ]]; then
        local mod
        mod=$(echo "$f" | sed -E 's|^frontend/src/views/([^/]+)/.*|\1|')
        if ! echo "$seen_fe_mods" | grep -qw "$mod" 2>/dev/null; then
          seen_fe_mods="${seen_fe_mods:+$seen_fe_mods }$mod"
        fi
      fi

      for pat in "${PUBLIC_INFRA_PATTERNS[@]}"; do
        if [[ "$f" == $pat* ]]; then
          HAS_PUBLIC_INFRA=true
          break
        fi
      done

    elif [[ "$f" == backend/* ]]; then
      HAS_BACKEND=true

      if [[ "$f" == backend/src/modules/* ]]; then
        local mod
        mod=$(echo "$f" | sed -E 's|^backend/src/modules/([^/]+)/.*|\1|')
        if ! echo "$seen_be_mods" | grep -qw "$mod" 2>/dev/null; then
          seen_be_mods="${seen_be_mods:+$seen_be_mods }$mod"
        fi
      fi

      for pat in "${PUBLIC_INFRA_PATTERNS[@]}"; do
        if [[ "$f" == $pat* ]]; then
          HAS_PUBLIC_INFRA=true
          break
        fi
      done

    elif [[ "$f" == docs/* ]]; then
      HAS_DOCS=true
    elif [[ "$f" == scripts/* ]]; then
      HAS_SCRIPTS=true
    else
      HAS_ROOT=true
    fi
  done <<< "$FILES"

  if [ -n "$seen_fe_mods" ]; then
    read -ra FE_MODULES <<< "$seen_fe_mods"
  fi
  if [ -n "$seen_be_mods" ]; then
    read -ra BE_MODULES <<< "$seen_be_mods"
  fi
  FE_MODULE_COUNT=${#FE_MODULES[@]}
  BE_MODULE_COUNT=${#BE_MODULES[@]}
}

analyze_files

CROSSES_BOUNDARY=false
if [ "$HAS_FRONTEND" = true ] && [ "$HAS_BACKEND" = true ]; then
  CROSSES_BOUNDARY=true
fi

TOTAL_BIZ_MODULES=$((FE_MODULE_COUNT + BE_MODULE_COUNT))

# ── S/M/L 自动分级 ───────────────────────────────────────────────────
#
# S (Small):  ≤3 文件 AND 单侧（仅前端或仅后端）AND ≤1 业务模块
# M (Medium): 4–10 文件 OR 跨前后端 OR 2–3 业务模块 OR 涉及公共基础设施
# L (Large):  >10 文件 OR (跨前后端 AND ≥3 业务模块) OR (公共基础设施 AND >5 文件)

compute_level() {
  if [ "$FILE_COUNT" -eq 0 ]; then
    echo "S"
    return
  fi

  if [ "$FILE_COUNT" -gt 10 ]; then
    echo "L"
    return
  fi

  if [ "$CROSSES_BOUNDARY" = true ] && [ "$TOTAL_BIZ_MODULES" -ge 3 ]; then
    echo "L"
    return
  fi

  if [ "$HAS_PUBLIC_INFRA" = true ] && [ "$FILE_COUNT" -gt 5 ]; then
    echo "L"
    return
  fi

  if [ "$FILE_COUNT" -gt 3 ]; then
    echo "M"
    return
  fi

  if [ "$CROSSES_BOUNDARY" = true ]; then
    echo "M"
    return
  fi

  if [ "$TOTAL_BIZ_MODULES" -ge 2 ]; then
    echo "M"
    return
  fi

  if [ "$HAS_PUBLIC_INFRA" = true ]; then
    echo "M"
    return
  fi

  echo "S"
}

COMPUTED_LEVEL=$(compute_level)

# ── 输出报告 ──────────────────────────────────────────────────────────

echo -e "${YELLOW}============================================================${NC}"
echo -e "${CYAN}📋 AI PLAN: 变更影响面分析${NC}"
echo -e "${YELLOW}============================================================${NC}"

echo ""
echo -e "${BOLD}[1/3] 影响面概要${NC}"
echo -e "   文件总数:    ${BOLD}${FILE_COUNT}${NC}"
echo -e "   前端变更:    $([ "$HAS_FRONTEND" = true ] && echo -e "${GREEN}是${NC}" || echo "否")"
echo -e "   后端变更:    $([ "$HAS_BACKEND" = true ] && echo -e "${GREEN}是${NC}" || echo "否")"
echo -e "   跨前后端:    $([ "$CROSSES_BOUNDARY" = true ] && echo -e "${YELLOW}是${NC}" || echo "否")"
echo -e "   公共基础设施: $([ "$HAS_PUBLIC_INFRA" = true ] && echo -e "${YELLOW}是${NC}" || echo "否")"
echo -e "   文档变更:    $([ "$HAS_DOCS" = true ] && echo "是" || echo "否")"
echo -e "   脚本变更:    $([ "$HAS_SCRIPTS" = true ] && echo "是" || echo "否")"
echo -e "   根目录变更:  $([ "$HAS_ROOT" = true ] && echo "是" || echo "否")"

if [ "$FE_MODULE_COUNT" -gt 0 ]; then
  echo -e "   前端业务模块: ${FE_MODULE_COUNT} 个 (${FE_MODULES[*]})"
fi
if [ "$BE_MODULE_COUNT" -gt 0 ]; then
  echo -e "   后端业务模块: ${BE_MODULE_COUNT} 个 (${BE_MODULES[*]})"
fi

echo ""
echo -e "${BOLD}[2/3] 分级结果${NC}"
echo -e "   脚本建议级别: ${BOLD}${COMPUTED_LEVEL}${NC}"

if [ -n "$DECLARED_LEVEL" ]; then
  echo -e "   AI 声明级别:  ${BOLD}${DECLARED_LEVEL}${NC}"
fi

level_to_num() {
  case "$1" in
    S) echo 1 ;; M) echo 2 ;; L) echo 3 ;; *) echo 2 ;;
  esac
}

MISMATCH=false
if [ -n "$DECLARED_LEVEL" ]; then
  DECLARED_NUM=$(level_to_num "$DECLARED_LEVEL")
  COMPUTED_NUM=$(level_to_num "$COMPUTED_LEVEL")

  if [ "$DECLARED_NUM" -lt "$COMPUTED_NUM" ]; then
    MISMATCH=true
    echo ""
    echo -e "   ${RED}⚠️  级别低估: 声明 ${DECLARED_LEVEL} 但影响面分析建议 ${COMPUTED_LEVEL}${NC}"
    echo -e "   ${YELLOW}建议: 升级到 ${COMPUTED_LEVEL}，或缩小变更范围以匹配 ${DECLARED_LEVEL}。${NC}"
  elif [ "$DECLARED_NUM" -gt "$COMPUTED_NUM" ]; then
    echo ""
    echo -e "   ${GREEN}✓ 声明 ${DECLARED_LEVEL} 高于建议 ${COMPUTED_LEVEL}，保守估计，无问题。${NC}"
  else
    echo ""
    echo -e "   ${GREEN}✓ 声明级别与建议级别一致。${NC}"
  fi
fi

# ── 分级对应的工作建议 ────────────────────────────────────────────────

EFFECTIVE_LEVEL="${DECLARED_LEVEL:-$COMPUTED_LEVEL}"
if [ "$MISMATCH" = true ]; then
  EFFECTIVE_LEVEL="$COMPUTED_LEVEL"
fi

echo ""
echo -e "${BOLD}[3/3] 工作建议 (${EFFECTIVE_LEVEL} 级)${NC}"

case "$EFFECTIVE_LEVEL" in
  S)
    echo -e "   ${GREEN}▸ S 级（小型变更）${NC}"
    echo "   • ≤3 个文件、单一目标、单侧（前端或后端）"
    echo "   • 可直接编码，完成后运行 npm run verify:fast"
    echo "   • 无需额外拆分任务"
    ;;
  M)
    echo -e "   ${YELLOW}▸ M 级（中型变更）${NC}"
    echo "   • 多文件或跨前后端"
    echo "   • 建议先拆分为多个 S 级子任务，每次聚焦单一目标"
    echo "   • 每个子任务完成后运行 npm run verify:fast"
    echo "   • 全部完成后运行 npm run verify"
    if [ "$CROSSES_BOUNDARY" = true ]; then
      echo -e "   ${YELLOW}• 跨前后端: 建议先完成后端 API，再对接前端${NC}"
    fi
    if [ "$HAS_PUBLIC_INFRA" = true ]; then
      echo -e "   ${YELLOW}• 涉及公共基础设施: 修改前确认影响范围，避免破坏其他模块${NC}"
    fi
    ;;
  L)
    echo -e "   ${RED}▸ L 级（大型变更）${NC}"
    echo "   • 大量文件或跨多模块 + 跨前后端"
    echo "   • 建议先拆分为 M 级阶段，再进一步拆为 S 级子任务"
    echo "   • 制定清晰的实施顺序：公共基础 → 后端模块 → 前端对接"
    echo "   • 每个 S 级子任务完成后运行 npm run verify:fast"
    echo "   • 全部完成后运行 npm run verify:full"
    if [ "$CROSSES_BOUNDARY" = true ]; then
      echo -e "   ${YELLOW}• 跨前后端: 先锁定 API 接口契约，前后端分别推进${NC}"
    fi
    if [ "$HAS_PUBLIC_INFRA" = true ]; then
      echo -e "   ${RED}• 涉及公共基础设施: 务必评估全局影响，优先完成基础层变更${NC}"
    fi
    ;;
esac

# ── 变更文件清单 ──────────────────────────────────────────────────────

if [ "$FILE_COUNT" -gt 0 ]; then
  echo ""
  echo -e "${BOLD}变更文件清单:${NC}"
  echo "$FILES" | head -30 | sed 's/^/   /'
  if [ "$FILE_COUNT" -gt 30 ]; then
    echo "   ... 及其他 $((FILE_COUNT - 30)) 个文件"
  fi
fi

echo ""
echo -e "${YELLOW}============================================================${NC}"

# ── 退出码 ────────────────────────────────────────────────────────────
# 0: 通过（级别匹配或无声明级别）
# 1: 级别低估警告（非阻断，仅提示）

if [ "$MISMATCH" = true ]; then
  exit 1
fi
exit 0
