# S05 — 前後端コード規範ルールセット

## 概要

本文件定义前后端 ESLint 规则集的统一标准，明确每条规则的严重等级（error 阻断 / warn 渐进清理）及分类依据。规则在 `frontend/eslint.config.mjs` 和 `backend/eslint.config.mjs` 中实现，通过 `verify:fast` 管道统一执行。

## 分级原则

| 等级 | 含义 | 行为 |
|------|------|------|
| **error** | 阻断级 — 不允许出现在提交代码中 | `lint` 返回非零退出码，阻断 pre-commit / CI |
| **warn** | 渐进级 — 现有代码允许暂存，新增代码应避免 | `lint` 正常退出，`lint:ci`（`--max-warnings 0`）可选阻断 |
| **off** | 不启用 | — |

## 共通规则（前后端均适用）

### 1. 调试残留 — Debug Remnants

| 规则 | 等级 | 说明 |
|------|------|------|
| `no-debugger` | error | `debugger` 语句绝不允许入库 |
| `no-console` | warn | 仅允许 `console.warn` / `console.error`；前端应使用业务日志封装，后端应使用 NestJS `Logger` |
| `no-alert` | error | `alert()` / `confirm()` / `prompt()` 不允许入库 |

### 2. 危险模式 — Dangerous Patterns

| 规则 | 等级 | 说明 |
|------|------|------|
| `no-eval` | error | 禁止 `eval()`，安全风险 |
| `no-implied-eval`* | error | 禁止 `setTimeout("code")` 等隐式 eval |
| `no-new-func` | error | 禁止 `new Function("code")`，等效 eval |
| `eqeqeq` | error | 强制 `===` / `!==`，避免隐式类型转换 |

> \* 前端使用 ESLint 基础 `no-implied-eval`；后端由 `@typescript-eslint/no-implied-eval`（`recommendedTypeChecked` 预设）覆盖，无需重复声明。

### 3. 危险注释 — Dangerous Comments

| 规则 | 等级 | 触发词 | 说明 |
|------|------|--------|------|
| `no-warning-comments` | warn | `FIXME` `HACK` `XXX` `BUG` | 标记技术债务，提醒清理；`TODO` 不在阻止范围内，作为正常任务标记允许保留 |

### 4. 导入顺序 — Import Ordering

| 规则 | 等级 | 说明 |
|------|------|------|
| `simple-import-sort/imports` | warn | 自动排序 import 语句，运行 `lint:fix` 即可自动修复 |
| `simple-import-sort/exports` | warn | 自动排序 export 语句 |

插件：`eslint-plugin-simple-import-sort`（前后端均已安装）。

自动修复命令：`npm run lint:fix`。

### 5. 复杂度 / 长度守卫 — Complexity Guards

| 规则 | 等级 | 阈值 | 说明 |
|------|------|------|------|
| `max-lines` | warn | 500 行（跳过空行和注释） | 文件过长信号，提示拆分 |
| `max-lines-per-function` | warn | 80 行（跳过空行和注释） | 方法过长信号，提示提取子函数 |

> 对于 `i18n/messages/*.ts` 这类纯静态语言包数据文件，可在 ESLint 中按目录关闭 `max-lines`，避免低价值噪音警告。

### 6. 未使用变量 — Unused Variables

| 规则 | 等级 | 说明 |
|------|------|------|
| `@typescript-eslint/no-unused-vars` | warn | 以 `_` 开头的参数/变量名自动豁免（`argsIgnorePattern: '^_'`，`varsIgnorePattern: '^_'`） |

### 7. 隐式 any — Implicit Any

| 规则 | 前端 | 后端 | 说明 |
|------|------|------|------|
| `@typescript-eslint/no-explicit-any` | warn | off | 前端渐进清理；后端现存大量 any，暂关闭（清理节奏见 `s19_rollout_order.md` Wave 6） |

## 前端专有规则（Vue）

| 规则 | 等级 | 说明 |
|------|------|------|
| `vue/block-order` | error | 强制 `<script>` → `<template>` → `<style>` 顺序 |
| `vue/component-api-style` | error | 强制 `<script setup>` |
| `vue/define-macros-order` | error | 宏声明顺序：`defineProps` → `defineEmits` → `defineOptions` → `defineSlots` |
| `vue/no-v-html` | warn | `v-html` 有 XSS 风险，提示审查 |
| `vue/no-mutating-props` | error | 禁止直接修改 prop（来自 `flat/recommended` 预设） |
| `vue/multi-word-component-names` | off | 单词组件名在项目中普遍存在，暂不阻断 |
| `vue/no-unused-refs` | warn | 未使用的 ref 应清理 |
| `vue/no-useless-v-bind` | warn | 静态值不需要 `v-bind` |
| `vue/prefer-true-attribute-shorthand` | warn | `prop="true"` → `prop` |

格式化相关 Vue 规则（`max-attributes-per-line`、`html-indent` 等）已关闭，等待 Prettier 引入后统一处理。

## 前端类型声明专有规则（`frontend/src/types/`）

| 规则 | 等级 | 说明 |
|------|------|------|
| `@typescript-eslint/consistent-type-imports` | error | 类型声明文件中的依赖须使用 `import type`，避免产生误导性的值导入 |
| `@typescript-eslint/no-explicit-any` | error | 共享类型定义禁止新增 `any`，应优先使用 `unknown`、联合类型或显式接口 |
| `simple-import-sort/imports` | error | 类型文件的 import 顺序必须稳定，便于审查 |
| `simple-import-sort/exports` | error | 类型汇总导出需保持稳定顺序，减少噪音 diff |

> `frontend/src/types/` 是全局复用的契约层，错误会快速扩散到页面、组件和 API，因此比普通前端目录采用更严格的阻断级规则。

## 前端严格目录专有规则（`stores/`、`utils/`、`api/`）

以下三个目录在通用规则基础上追加 error 级别的覆盖，已在 `frontend/eslint.config.mjs` 中实现。

### 共通严格规则

| 规则 | 等级 | 说明 |
|------|------|------|
| `@typescript-eslint/explicit-function-return-type` | error | 导出函数和公开方法必须显式声明返回类型（`allowExpressions`、`allowTypedFunctionExpressions` 豁免） |
| `simple-import-sort/imports` | error | import 顺序不可回退（通用为 warn） |
| `simple-import-sort/exports` | error | export 顺序不可回退（通用为 warn） |
| `jsdoc/require-jsdoc` | error | 2 行以上函数必须有 JSDoc（通用 JSDoc gate 为 warn） |
| `jsdoc/require-param` | error | 参数须有 `@param` |
| `jsdoc/require-param-description` | error | `@param` 须有描述 |
| `jsdoc/require-returns` | error | 非 void 须有 `@returns` |
| `jsdoc/require-returns-description` | error | `@returns` 须有描述 |
| `jsdoc/match-description` | error | 描述须包含中文 |

### `api/` 额外规则

| 规则 | 等级 | 说明 |
|------|------|------|
| `@typescript-eslint/consistent-type-imports` | error | API 函数的类型依赖须使用 `import type`，与 `types/` 保持一致 |

> 这三个目录是前端最核心的公共基础：`stores/` 管理全局状态、`utils/` 提供通用工具、`api/` 定义后端契约。它们的代码质量直接影响所有页面和组件，因此率先从 warn 升级为 error。

### 通用 JSDoc gate（warn 级别）

除上述三个严格目录外，以下目录受通用 JSDoc gate 覆盖，当前等级为 **warn**：

- `composables/`、`directives/`、`constants/`、`i18n/`、`router/`

通用 gate 检查项与严格目录相同（require-jsdoc、require-param 等），但等级为 warn，在 pre-commit 中不阻断。后续升级节奏见 `docs/s19_rollout_order.md` Wave 5。

### `.vue` JSDoc gate（warn 级别）

`.vue` 文件受独立的 JSDoc gate 覆盖，采用比 `.ts` 更保守的策略：

| 配置项 | 值 | 说明 |
|--------|------|------|
| 目标函数类型 | `FunctionDeclaration` only | 仅具名函数声明；箭头函数、函数表达式、生命周期回调、watch 回调自动豁免 |
| 最小行数阈值 | `minLineCount: 6` | 总行数（含签名和闭括号）不足 6 行的简短函数自动豁免 |
| 等级 | warn | 不阻断提交，仅作为渐进覆盖信号 |
| 检查项 | `require-jsdoc`、`require-param`、`require-returns`、`match-description` | 与 `.ts` 通用 gate 一致 |

此设计刻意保守，避免 `<script setup>` 中大量短小事件处理器和 UI 回调引入低价值噪音。Layer 2（`check-jsdoc.mjs`）当前不覆盖 `.vue` 文件。后续升级节奏见 `docs/s19_rollout_order.md` Wave 7b。

## 后端专有规则

| 规则 | 等级 | 说明 |
|------|------|------|
| `@typescript-eslint/no-floating-promises` | warn | 未处理的 Promise 应 await 或 void |
| `@typescript-eslint/no-unsafe-argument` | warn | 不安全的参数传递提示 |
| `prettier/prettier` | error | 格式统一由 Prettier 驱动 |

后端使用 `tseslint.configs.recommendedTypeChecked` 预设，已包含类型感知规则（`no-implied-eval`、`no-misused-promises`、`require-await` 等），无需重复声明。

## 预设来源汇总

| 配置层 | 前端 | 后端 |
|--------|------|------|
| ESLint 基础 | `eslint.configs.recommended` | `eslint.configs.recommended` |
| TypeScript | `tseslint.configs.recommended` | `tseslint.configs.recommendedTypeChecked` |
| 框架 | `pluginVue.configs['flat/recommended']` | — |
| 格式化 | —（未引入 Prettier） | `eslint-plugin-prettier/recommended` |
| 导入排序 | `eslint-plugin-simple-import-sort` | `eslint-plugin-simple-import-sort` |

## 当前影响评估（S05 实施后）

### 前端

| 规则 | 数量 | 等级 | 可自动修复 |
|------|------|------|-----------|
| `simple-import-sort/imports` | ~91 | warn | ✅ `lint:fix` |
| `simple-import-sort/exports` | ~2 | warn | ✅ `lint:fix` |
| `eqeqeq` | ~7 | error | 部分可 `lint:fix` |
| `max-lines` | ~3 | warn | ❌ 需重构 |
| `max-lines-per-function` | ~2 | warn | ❌ 需重构 |
| `@typescript-eslint/no-explicit-any` | ~34 | warn | ❌ 需手动 |
| `vue/no-mutating-props` | ~13 | error | ❌ 需重构 |
| 其他预存 | ~19 | 混合 | — |
| **合计** | **~171** | 29 error / 142 warn | — |

### 后端

后端预存约 5,430 个问题（主体为 Prettier 格式问题），新增规则（`no-console`、`simple-import-sort`、`eqeqeq`、`max-lines` 等）的增量影响相对较小，绝大多数可通过 `lint:fix` 批量修复。

## 渐进启用策略

1. **当前阶段**：所有新增规则已写入 ESLint 配置，`lint` 会报告但不阻断（warn 级别不影响退出码）。
2. **批量清理与升级节奏**：详见 `docs/s19_rollout_order.md`。优先处理 auto-fixable 项（Wave 1），再逐步将 warn 升级为 error（Wave 4/6）。
3. **门禁升级**：当预存问题清零后，可将 `lint:ci`（`--max-warnings 0`）接入 pre-commit / CI 实现全面阻断。
