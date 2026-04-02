# S19 — 整体落地顺序与渐进启用计划

## 概要

本文件定义门禁体系从"已安装、warn 级别"到"全面阻断"的渐进升级节奏。目标是在不阻塞日常开发的前提下，有序清理预存问题，逐步将所有检查项升级为阻断级门禁。

本计划覆盖：ESLint 代码规范、JSDoc 两层检查、TypeScript 类型检查、单元测试、构建验证、Git hooks、CI、部署门禁。

---

## 当前基线（实施前现状）

> 以下数据取自 S04/S05 实施后的首次执行结果，作为渐进清理的起点。

### 前端

| 检查项 | 问题数 | 等级 | 可自动修复 |
|--------|--------|------|-----------|
| `simple-import-sort/imports` | ~91 | warn | ✅ `lint:fix` |
| `simple-import-sort/exports` | ~2 | warn | ✅ `lint:fix` |
| `eqeqeq` | ~7 | error | 部分可 `lint:fix` |
| `max-lines` | ~3 | warn | ❌ 需重构 |
| `max-lines-per-function` | ~2 | warn | ❌ 需重构 |
| `@typescript-eslint/no-explicit-any` | ~34 | warn | ❌ 需手动 |
| `vue/no-mutating-props` | ~13 | error | ❌ 需重构 |
| 其他预存（含 JSDoc Layer 1） | ~19 + ~60–80 | 混合 | — |
| `type-check` 错误 | ~4 | error | ❌ 需手动 |
| **合计预存 error** | **~29** | — | — |

### 后端

| 检查项 | 问题数 | 等级 | 可自动修复 |
|--------|--------|------|-----------|
| Prettier 格式问题 | ~5,300+ | error | ✅ `lint:fix` |
| `simple-import-sort` | ~50–100 | warn | ✅ `lint:fix` |
| 其他规则（含 JSDoc Layer 1） | ~150–200 | warn | — |
| **合计预存 error** | **~5,300+** | — | — |

### JSDoc Layer 2（`check-jsdoc.mjs`）

当前现有代码几乎无 JSDoc，脚本"无检查对象"不会报错。随着新代码添加 JSDoc，Layer 2 确保质量从一开始就达标。现有代码暂不受影响。

---

## 渐进启用原则

1. **先清理可自动修复项，再处理需手动修改项** — 投入产出比最高的工作优先。
2. **先稳定 error 级别，再收紧 warn → error** — 确保 lint 退出码可靠后再开始依赖它。
3. **新增代码立即适用新标准，存量代码分批清理** — 不阻塞业务开发。
4. **每次升级前先在本地确认影响面** — 运行 `npm run lint:frontend 2>&1 | tail -20` 确认剩余问题数。
5. **保留紧急逃生口** — `--no-verify` 和 `--skip-verify` 始终可用，但须事后补救。

---

## 阶段划分

### Wave 0 — 当前状态（已完成）

**目标**：基础设施就位，所有检查"可运行但不全面阻断"。

| 已就位项 | 状态 |
|----------|------|
| 前后端 ESLint 配置（含新增规则） | ✅ warn 级别 |
| JSDoc Layer 1（eslint-plugin-jsdoc） | ✅ warn 级别 |
| JSDoc Layer 2（check-jsdoc.mjs） | ✅ error 级别（新增 JSDoc 立即阻断质量问题） |
| verify:fast / verify / verify:full | ✅ 可执行 |
| ai-deliver.sh 三模式 | ✅ 可执行 |
| pre-commit hook（lint-staged） | ✅ 仅检查暂存文件 |
| pre-push hook（ai-deliver --standard） | ✅ 全量检查 |
| CI quality-gate.yml（7 并列 Job） | ✅ 可执行 |
| deploy.sh 前置门禁 | ✅ 默认 --standard |

**当前效果**：
- pre-commit 对新改文件做增量 lint + JSDoc 检查（warn 不阻断，error 阻断）。
- pre-push 做全量标准检查（失败即阻断 push）。
- CI 做全量 verify:full（失败阻断合并）。
- deploy.sh 默认做 --standard 检查（失败阻断部署）。

**已阻断的 error**：
- `no-debugger`、`no-alert`、`no-eval`、`no-new-func`、`eqeqeq`
- `vue/block-order`、`vue/component-api-style`、`vue/define-macros-order`、`vue/no-mutating-props`
- 后端 `prettier/prettier`
- JSDoc Layer 2 内容质量（对已有 JSDoc 的质量检查）

**已提前升级为 error 的前端严格目录**：
- `stores/`、`utils/`、`api/`：JSDoc Layer 1 全部规则、`explicit-function-return-type`、`simple-import-sort` 均已为 error。
- `types/`：`consistent-type-imports`、`no-explicit-any`、`simple-import-sort` 均已为 error。
- 其余 JSDoc 强制目录（`composables/`、`directives/`、`constants/`、`i18n/`、`router/`）仍为 warn。

---

### Wave 1 — 批量自动修复（预计 1–2 天）

**目标**：消灭可自动修复的预存问题，大幅降低 warning 基数。

**执行步骤**：

1. **后端 Prettier 格式化**
   ```bash
   cd backend && npm run lint:fix
   ```
   预期消除 ~5,300 个 Prettier 格式问题。单次 commit，不混入业务变更。

2. **前后端 import 排序**
   ```bash
   cd frontend && npm run lint:fix
   cd backend && npm run lint:fix
   ```
   预期消除前端 ~93 个、后端 ~50–100 个 import 排序问题。

3. **前端 eqeqeq 自动修复**
   ```bash
   cd frontend && npx eslint src --fix --rule 'eqeqeq: error'
   ```
   可修复的部分自动处理，剩余手动检查。

4. **验证**
   ```bash
   npm run verify:fast
   ```
   确认自动修复未引入新问题。

**交付标准**：后端 error 归零或仅剩少量需手动处理的非 Prettier 问题。前端 warn 数量从 ~142 降至 ~50 以下。

**升级项**：无。本阶段仅做清理，不改变严重等级。

---

### Wave 2 — 手动清理 error 项 + 类型修复（预计 3–5 天）

**目标**：确保 `npm run lint:frontend` 和 `npm run type-check:frontend` 的 error 数归零。

**执行步骤**：

1. **前端 `vue/no-mutating-props`（~13 处）** — 逐个修复为 emit 或 computed set 模式。
2. **前端 `eqeqeq` 剩余不可自动修复项（~2–3 处）** — 手动改为 `===`。
3. **前端 `type-check` 错误（~4 处）** — 补齐类型声明。
4. **后端残留 error（如有）** — 按 `npm run lint:backend 2>&1 | grep 'error'` 逐条清理。

**验证**：

```bash
npm run lint:frontend     # 0 errors, N warnings
npm run lint:backend      # 0 errors, N warnings
npm run type-check:frontend  # 0 errors
npm run type-check:backend   # 0 errors（已通过）
```

**升级项**：完成后，`verify:fast` 和 `verify` 的退出码将完全可靠（error = 退出 1，warn = 退出 0）。从此刻起，所有门禁的阻断行为可信赖。

**里程碑**：`npm run verify` 全部通过（0 error）。

---

### Wave 3 — JSDoc 增量覆盖（持续，随业务迭代）

**目标**：新增/修改的方法必须携带合格 JSDoc，存量代码按模块逐步补齐。

**策略**：

| 时期 | 对新代码 | 对存量代码 |
|------|---------|-----------|
| Wave 3 起 | Layer 1 warn + Layer 2 error = 新增 JSDoc 质量立即阻断 | 不强制补写 |
| Wave 5 起 | Layer 1 error = 缺失 JSDoc 即阻断 | 按优先级批量补写 |

**存量补写优先级**：

| 优先级 | 目录 | 理由 |
|--------|------|------|
| P0 | `frontend/src/composables/` | 被多个组件共用，理解成本高 |
| P0 | `backend/src/modules/auth/` | 认证逻辑，安全关键 |
| P1 | `frontend/src/stores/` | 全局状态，影响面大 |
| P1 | `backend/src/modules/*/\*.service.ts` | 核心业务逻辑 |
| P2 | `frontend/src/utils/`、`frontend/src/api/` | 工具函数 |
| P2 | `backend/src/modules/*/\*.controller.ts` | API 入口 |
| P3 | `backend/src/common/` | 拦截器、过滤器、Helper |

**交付节奏**：每次业务开发迭代时，若修改了强制目录中的文件，顺带为该文件的所有方法补写 JSDoc（"摸到即补"原则）。

---

### Wave 4 — warn → error 首批升级（Wave 2 完成后 1 周）

**前提条件**：Wave 2 已完成，`npm run verify` 全量通过。

**升级规则（低风险、高价值）**：

| 规则 | 原等级 | 新等级 | 影响面 | 理由 |
|------|--------|--------|--------|------|
| `simple-import-sort/imports` | warn | error | 已在 Wave 1 批量修复 | auto-fixable，不应再回退 |
| `simple-import-sort/exports` | warn | error | 同上 | 同上 |
| `no-console` | warn | warn | 保持不变 | 前端尚需封装日志层 |
| `@typescript-eslint/no-unused-vars` | warn | error | ~0（Wave 1 后） | 代码卫生基本项 |

**操作方法**：修改 `frontend/eslint.config.mjs` 和 `backend/eslint.config.mjs` 中对应规则的等级。

**验证**：

```bash
npm run lint:frontend   # 确认 0 new errors
npm run lint:backend    # 确认 0 new errors
npm run verify:fast     # 通过
```

**回退方案**：若升级后发现大量遗漏（>10 处新增 error），降回 warn 并再做一轮批量修复。

---

### Wave 5 — JSDoc Layer 1 升级为 error（Wave 3 存量补写完成 50% 后）

**前提条件**：前端强制目录 P0/P1 文件已全部补写 JSDoc，后端 P0/P1 service 已全部补写。

> **注意**：前端 `stores/`、`utils/`、`api/` 已在 Wave 0 阶段提前升级为 error。本 Wave 的升级对象为前端剩余 warn 目录（`composables/`、`directives/`、`constants/`、`i18n/`、`router/`）和后端全部 JSDoc 目录。

**升级规则**：

| 规则 | 原等级 | 新等级 | 影响面 |
|------|--------|--------|--------|
| `jsdoc/require-jsdoc` | warn | error | 前端剩余目录 + 后端强制目录 |
| `jsdoc/require-param` | warn | error | 同上 |
| `jsdoc/require-param-description` | warn | error | 同上 |
| `jsdoc/require-returns` | warn | error | 同上 |
| `jsdoc/require-returns-description` | warn | error | 同上 |
| `jsdoc/match-description` | warn | error | 同上 |

**操作方法**：修改两端 `eslint.config.mjs` 中 JSDoc gate 块的规则等级（前端仅需修改通用 gate 块，严格目录已为 error）。

**验证**：

```bash
npm run lint:frontend 2>&1 | grep -c 'error'   # 确认无新增 error
npm run lint:backend 2>&1 | grep -c 'error'    # 确认无新增 error
npm run verify:fast                              # 通过
```

**升级后效果**：在强制目录中新增/修改的函数若缺失 JSDoc，pre-commit 立即阻断。

---

### Wave 6 — 渐进清理 warn 残余（持续，低优先级）

**目标**：将剩余 warn 逐步清理至零，最终启用零容忍模式。

**涉及规则**：

| 规则 | 当前等级 | 清理策略 | 最终目标 |
|------|---------|---------|---------|
| `no-console` | warn | 前端引入日志封装层后升级 | error |
| `@typescript-eslint/no-explicit-any`（前端） | warn | 每次修改文件时顺带清理 | error |
| `@typescript-eslint/no-explicit-any`（后端） | off | 待后端 any 基数评估后启用 warn | warn → error |
| `@typescript-eslint/no-floating-promises`（后端） | warn | 逐步补 await/void | error |
| `@typescript-eslint/no-unsafe-argument`（后端） | warn | 逐步补类型 | error |
| `vue/no-v-html` | warn | 逐一审查安全性 | error |
| `max-lines` / `max-lines-per-function` | warn | 保持 warn，仅作重构信号 | warn（不升级） |
| `no-warning-comments` | warn | 保持 warn，仅作提醒 | warn（不升级） |

**零容忍模式**：当所有 warn 清零后，可在 CI 中启用 `--max-warnings 0`：

```bash
# 前端
cd frontend && npx eslint src --max-warnings 0

# 后端（已预留 lint:ci 脚本）
npm run lint:ci:backend
```

此模式使任何新增 warning 都会阻断 CI，适合进入稳定维护期后启用。

---

### Wave 7 — 结构规则与 `.vue` JSDoc（Wave 4 后启动）

**目标**：补齐 ESLint 中缺失的结构复杂度约束，并为 `.vue` 文件设计可落地的 JSDoc 方案。

#### 7a. 结构规则

在前后端 `eslint.config.mjs` 中新增以下规则，初始等级 **warn**：

| 规则 | 建议阈值 | 说明 |
|------|---------|------|
| `complexity` | 15–20 | 约束分支复杂度，超出提示重构 |
| `max-depth` | 4 | 约束嵌套深度，超出提示提取子函数 |

保留现有 `max-lines` / `max-lines-per-function` 为 warn，作为拆分信号。

`no-else-return`、`curly`、`brace-style` 等风格规则暂不引入，适合在稳定期再评估。

#### 7b. `.vue` JSDoc 方案（已实施）

`.vue` 的 JSDoc 不直接照搬 `.ts` 目录规则（`<script setup>` 中大量箭头函数、事件处理器和生命周期回调，全函数强制会引入大量低价值噪音）。

**已落地方案**：

1. **Layer 1（已实施）**：在 `frontend/eslint.config.mjs` 中为 `src/**/*.vue` 添加保守的 JSDoc gate，等级 **warn**。
   - 仅覆盖具名函数声明（`FunctionDeclaration`），箭头函数、函数表达式、生命周期回调自动豁免。
   - `minLineCount: 6`（总行数不足 6 行的简短处理函数豁免）。
   - 检查项：`require-jsdoc`、`require-param`、`require-param-description`、`require-returns`、`require-returns-description`、`match-description`（中文描述）。
   - 实测影响：约 160 个 warn，集中在 `views/` 下的列表页、表单弹窗、Tab 组件中的业务函数。无新增 error。
2. **Layer 2（评估结论：暂不扩展）**：`check-jsdoc.mjs` 当前不解析 `.vue` 文件。原因：
   - Layer 1 已提供存在性与结构检查，warn 阶段收益有限。
   - 正则解析器需新增 `<script setup>` 提取逻辑，复杂度高于当前收益。
   - 重新评估条件：`.vue` Layer 1 升级为 error 且库内 `.vue` JSDoc 覆盖率达 50% 以上。
3. **lint-staged（无需额外改动）**：`.vue` 文件已在 lint-staged 的 ESLint 检查范围内（`frontend/src/**/*.{ts,vue}`），Layer 1 规则自动对暂存的 `.vue` 文件生效。

**已验证 SFC 类型**：路由页（`CustomerListView.vue`）、CRUD 弹窗（`AdminCaseFormDialog.vue`）、复杂 Tab（`PeriodsTab.vue`）。阈值合理，简短 UI 处理函数（`handleAdd`、`handleSaved`）豁免，含业务逻辑的函数（`handleDelete`、`handleSubmit`、`fetchPeriods`）被正确标记。

**后续升级路径**：

| 阶段 | 条件 | 动作 |
|------|------|------|
| `.vue` warn 试运行 | 当前状态 | 随业务迭代逐步补写 JSDoc |
| `.vue` warn → error | 库内 `.vue` JSDoc 覆盖率 > 70%，warn 数降至 30 以下 | 升级 `require-jsdoc` 为 error |
| Layer 2 扩展评估 | `.vue` Layer 1 为 error 且覆盖率 > 50% | 评估是否扩展 `check-jsdoc.mjs` |

---

## 升级决策流程

每次升级前需确认以下检查清单：

```
□ 1. 运行 lint / verify:fast 确认当前该规则的违规数为 0（或可接受范围）
□ 2. 评估升级后对现有开发流程的阻塞风险
□ 3. 确认团队/AI 已了解新规则的修复方式
□ 4. 在本地验证升级后 verify:fast 通过
□ 5. 单独 commit 规则升级，不混入业务变更
□ 6. 升级后观察 1–2 个工作日，确认无异常阻塞
```

---

## 时间线总览

```
时间       Wave    核心动作                              阻断升级
─────────────────────────────────────────────────────────────────
Day 0      W0      基础设施就位（已完成）                 error: 安全规则 + Vue 关键规则
                   stores/utils/api JSDoc 已为 error      stores/utils/api 率先严格
Day 1–2    W1      批量自动修复（Prettier/import/eqeqeq） —
Day 3–7    W2      手动清理 error + type 错误             verify 退出码完全可信
Day 8–14   W4      import-sort/unused-vars → error        首批 warn → error
持续       W3      JSDoc 增量覆盖（摸到即补）             Layer 2 对新代码即时阻断
P0/P1 50%  W5      JSDoc Layer 1 → error                  缺失 JSDoc 即阻断
持续       W6      any/console/floating-promises 渐进清理 逐条升级
W4 之后    W7      结构规则(warn) + .vue JSDoc 方案       complexity/max-depth 落地
全清零     —       CI 启用 --max-warnings 0               零容忍模式
```

> 以上天数为预估值。实际节奏可根据业务迭代压力调整，但 **Wave 1–2 应在门禁体系上线后两周内完成**，否则预存问题会给团队带来"门禁不可信"的印象。

---

## 各门禁层的启用节奏

| 门禁层 | Wave 0（当前） | Wave 2 后 | Wave 5 后 | 全清零后 |
|--------|---------------|-----------|-----------|---------|
| **pre-commit** | lint-staged：error 阻断，warn 放行 | 同左 | JSDoc 缺失阻断 | `--max-warnings 0` 可选 |
| **pre-push** | ai-deliver --standard：error 阻断 | 完全可信阻断 | + JSDoc 阻断 | 零容忍 |
| **CI** | quality-gate.yml：error 阻断 | 完全可信阻断 | + JSDoc 阻断 | 零容忍 |
| **deploy** | ai-deliver --standard：error 阻断 | 完全可信阻断 | + JSDoc 阻断 | 零容忍 |

---

## 紧急逃生口

所有阶段都保留以下紧急手段：

| 场景 | 手段 | 约束 |
|------|------|------|
| pre-commit 阻塞紧急 hotfix | `git commit --no-verify` | 事后须通过 `verify:fast` |
| pre-push 阻塞紧急 hotfix | `git push --no-verify` | 事后须通过 `verify` |
| deploy 阻塞紧急上线 | `./scripts/deploy.sh --skip-verify` | 须在上线后立即补验 |
| CI 持续红灯影响合并 | 临时降级规则等级（warn → off 或 error → warn） | 须创建 issue 跟踪恢复 |

**原则**：逃生口仅用于紧急场景，使用后必须在下一个工作日内补救。连续使用逃生口超过 3 次须触发团队复盘。

---

## 与现有文档的衔接

| 文档 | 本计划提供的输入 |
|------|----------------|
| `docs/s05_style_rules.md` §前端严格目录 / §渐进启用策略 | Wave 0 严格目录现状、Wave 4/6/7 的规则升级时间点 |
| `docs/s06_jsdoc_standard.md` §强制范围 | 各目录的门禁级别（error / warn / 评审约定）与 `.vue` 说明 |
| `docs/s07_jsdoc_gate_design.md` §当前严重等级 | Wave 5 的 Layer 1 升级时间点 |
| `docs/s04_root_verify_design.md` §扩展点 | 零容忍模式的启用条件 |
| `AGENTS.md` §5/§6/§8 | 规则等级变更时需同步更新摘要和目录标注 |
| `docs/18_上線チェックリスト.md` §5 | 部署前门禁级别随 Wave 自动收紧 |
