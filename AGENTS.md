# AGENTS.md — AI 工作規約

> 本文件是 AI 参与本仓库开发时的**唯一总入口**。
> 任何 AI 接手任务前，**必须先通读本文件**，再按指引阅读专题文档。

---

## 1. 项目概要

- **产品**：事務所管理システム（行政書士 + 税理士事務所向け内部管理後台）
- **前端**：Vue 3 + TypeScript + Element Plus + Pinia + Vue Router
- **后端**：NestJS + TypeScript + TypeORM + PostgreSQL
- **定位**：公司内部轻量业务管理后台，用户量有限，以效率和可维护性为核心目标

---

## 2. 必读文档清单

按需阅读，不要求每次全部读完。根据当前任务选取对应层级。

### 第一层 — 背景与边界（首次接手时必读）

| 文档 | 用途 |
|------|------|
| `docs/事务所管理系统_需求分析与开发说明.md` | 业务需求基线 |
| `docs/01_总体架构与实施规划.md` | 架构、模块划分、一期范围 |
| `docs/04_技术选型与后端语言推荐.md` | 技术栈选择理由 |

### 第二层 — 执行规范（每轮任务前按需读取）

| 文档 | 用途 |
|------|------|
| `docs/16_AI执行总入口与任务拆解.md` | 大阶段路线图与任务拆分 |
| `docs/09_详细开发执行步骤.md` | 开发步骤详解 |
| `docs/15_单人并行开发编排与依赖关系.md` | 并行/串行依赖 |

### 第三层 — 专题参考（涉及具体模块时查阅）

| 文档 | 用途 |
|------|------|
| `docs/02_管理后台前端界面设计.md` | 页面结构与交互 |
| `docs/03_数据库设计.md` | 表结构 |
| `docs/06_API接口设计.md` | REST API 规约 |
| `docs/07_权限矩阵与角色设计.md` | RBAC 设计 |
| `docs/17_业务口径冻结确认表.md` | 枚举、财务规则、文件策略等已冻结口径 |

### 第四层 — 代码规范与门禁

| 文档 | 用途 |
|------|------|
| `docs/s05_style_rules.md` | ESLint 规则集（分级、阻断/渐进） |
| `docs/s06_jsdoc_standard.md` | 方法级 JSDoc 书写标准与模板 |
| `docs/s07_jsdoc_gate_design.md` | JSDoc 自动检查两层架构 |
| `docs/s19_rollout_order.md` | 渐进启用计划（warn → error 升级节奏） |

---

## 3. 执行纪律

### 3.1 六条总原则

1. **先确认边界，再改代码** — 明确本次任务范围，不越界修改无关文件。
2. **先做主流程，再补增强项** — 核心路径优先，边角功能后置。
3. **先做公共基础，再做业务模块** — 避免重复造轮子。
4. **先补测试，再合并收口** — 关键逻辑须有测试保护。
5. **能小步完成就不要一次改太大** — 单次修改粒度可控、可审查。
6. **遇到关键业务口径不明确时，先停下来确认** — 不要猜。

### 3.2 每次开始前

1. 确认当前属于哪个大阶段（见 `docs/16_AI执行总入口与任务拆解.md` §4）。
2. 确认本轮前置条件已完成。
3. 列出本轮会修改的文件，评估是否与其他窗口/分支冲突。
4. 按需阅读上方文档清单中对应层级的文档。

### 3.3 每次交付前

1. 确认本轮目标已完成。
2. 确认没有修改不该动的公共文件。
3. 确认已补对应的单元测试（如涉及业务逻辑）。
4. **运行校验命令**（见下文 §4），确保通过后再交付。
5. 确认必要文档已同步更新。
6. 说明下一步建议。

---

## 4. 校验命令

本仓库提供三层递进式校验入口，AI 和人工开发共用同一套：

| 命令 | 包含检查 | 适用场景 |
|------|----------|----------|
| `npm run verify:fast` | lint（前后端） + type-check（前后端） + JSDoc 质量检查 | 开发自查、快速交付 |
| `npm run verify` | verify:fast + test（前后端） | 标准交付、pre-push |
| `npm run verify:full` | verify + build（前后端） | CI 全量门禁、部署前 |

### 调用链路

```
verify:fast
  ├── lint:frontend        → eslint src（含 jsdoc 存在性检查）
  ├── lint:backend         → eslint（含 jsdoc 存在性检查）
  ├── type-check:frontend  → vue-tsc --noEmit
  ├── type-check:backend   → tsc --noEmit
  └── jsdoc:check          → node scripts/check-jsdoc.mjs（内容质量检查）

verify
  ├── verify:fast
  ├── test:frontend        → vitest run
  └── test:backend         → jest

verify:full
  ├── verify
  ├── build:frontend       → vue-tsc -b && vite build
  └── build:backend        → nest build
```

### Pre-commit Hook（自動門禁）

提交时 **husky** + **lint-staged** 自动对已暂存文件执行快速检查：

```
pre-commit
  ├── lint-staged
  │   ├── frontend .ts/.vue  → ESLint（含 JSDoc Layer 1）
  │   ├── backend .ts        → ESLint（含 JSDoc Layer 1）
  │   └── 强制目录 .ts       → check-jsdoc.mjs（Layer 2 质量检查）
```

- 仅检查 staged 文件，速度快。
- 紧急跳过：`git commit --no-verify`（不推荐，交付前仍须通过 `verify:fast`）。

### Pre-push Hook（全量門禁）

push 时自动执行标准レベル検査（`ai-deliver.sh --standard`）：

```
pre-push
  └── ai-deliver.sh --standard
        ├── lint:frontend + lint:backend
        ├── type-check:frontend + type-check:backend
        ├── jsdoc:check
        ├── test:frontend (vitest)
        └── test:backend (jest)
```

- push 対象のコミットがない場合はスキップ。
- 紧急跳过：`git push --no-verify`（不推荐，push 前仍须通过 `verify`）。

### 交付最低要求

- **日常开发**：`npm run verify:fast` 通过。
- **功能完成**：`npm run verify` 通过。
- **发布/部署前**：`npm run verify:full` 通过。`deploy.sh` 默认自动执行 `ai-deliver.sh --standard` 门禁，紧急时可用 `--skip-verify` 跳过。

---

## 5. 代码规范要点

详细规则见 `docs/s05_style_rules.md`，此处仅列关键约束。

### 阻断级（error）— 全局

- 禁止 `debugger`、`alert()`、`eval()`、`new Function()`。
- 强制 `===` / `!==`（`eqeqeq`）。
- Vue：强制 `<script setup>` + `<script>` → `<template>` → `<style>` 块顺序。
- Vue：禁止直接修改 prop（`vue/no-mutating-props`）。

### 阻断级（error）— 前端严格目录

`stores/`、`utils/`、`api/` 三个目录在通用规则基础上追加 error 级别覆盖：

- 导出函数必须显式声明返回类型（`explicit-function-return-type`）。
- 导入排序（`simple-import-sort`）为 error（通用为 warn）。
- JSDoc Layer 1 全部规则为 error（通用为 warn），缺失 JSDoc 即阻断提交。
- `api/` 额外要求 `import type`（`consistent-type-imports`）。
- `types/` 目录要求 `import type`、禁止 `any`、导入排序均为 error。

### 渐进级（warn）

- `no-console`：允许 `console.warn` / `console.error`，前端应使用业务日志封装。
- 导入排序（`simple-import-sort`）：通用为 warn，`npm run lint:fix` 可自动修复（严格目录除外）。
- 未使用变量：`_` 前缀豁免。
- 前端 `@typescript-eslint/no-explicit-any`：渐进清理。
- 文件 > 500 行、函数 > 80 行：提示拆分。
- 危险注释（`FIXME` / `HACK` / `XXX` / `BUG`）：提示清理。

---

## 6. JSDoc 规范要点

详细标准见 `docs/s06_jsdoc_standard.md`，模板见该文档 §模板 A–H。

### 强制范围

**前端（error — 自动门禁阻断）**：`stores/`、`utils/`、`api/`。

**前端（warn — 自动门禁提示）**：`composables/`、`directives/`、`constants/`、`i18n/`、`router/`。

**前端（warn — 自动门禁提示，保守策略）**：`.vue` 组件内 6 行以上的具名函数声明（箭头函数、生命周期回调、5 行以下短函数豁免）。

**后端（warn — 自动门禁提示）**：`*.service.ts`、`*.controller.ts`、`guards/`、`interceptors/`、`helpers/`、`filters/`。

### 必填字段

| # | 字段 | 何时可省略 |
|---|------|-----------|
| 1 | **用途描述**（正文首行） | 不可省略 |
| 2 | `@param` 逐项说明 | 无参数时 |
| 3 | `@returns` 返回值含义 | 返回 void 时 |
| 4 | `@throws` / 副作用说明 | 无副作用、无异常时 |

### 禁止的空泛描述

> 处理、获取、设置、执行、操作、初始化、处理数据、获取信息、辅助方法 …

描述须包含"动词 + 业务对象 + 关键限定条件"，有效字符不少于 8 个。

### 两层自动检查

- **Layer 1**（ESLint `eslint-plugin-jsdoc`）：随 `npm run lint` 执行，检查存在性与结构。覆盖 `.ts` 强制目录和 `.vue` 文件（`.vue` 仅检查 6 行以上具名函数声明，等级 warn）。
- **Layer 2**（`scripts/check-jsdoc.mjs`）：随 `npm run jsdoc:check` 执行，检查内容质量（空泛词、最小长度、@throws 覆盖）。仅覆盖 `.ts` 文件，`.vue` 暂不纳入。

---

## 7. 技术约定

### 前端

- 全部使用 **Composition API** + `<script setup lang="ts">`，禁止 Options API。
- 状态管理使用 **Pinia**（Setup Store 风格）。
- UI 框架为 **Element Plus**，布局和组件优先使用 Element Plus 提供的方案。
- 路由使用 **Vue Router 4**。
- 国际化使用 **vue-i18n**（当前为中日双语）。
- 测试使用 **Vitest** + **@vue/test-utils**。

### 后端

- 框架为 **NestJS**，遵循模块化架构（`modules/` 按业务领域划分）。
- ORM 使用 **TypeORM**，数据库迁移通过 `migration:generate` / `migration:run`。
- 认证使用 **Passport** + **JWT**。
- 格式化由 **Prettier** 驱动（后端已配置 `eslint-plugin-prettier`）。
- 测试使用 **Jest** + **@nestjs/testing**。

### 通用

- TypeScript 严格模式，避免无谓的 `any`。
- 新增代码必须通过 `verify:fast`。
- 提交信息使用中文或日文均可，须简明描述变更内容。

---

## 8. 目录结构速查

```
cms/
├── .husky/                ← Git hooks（pre-commit 快速門禁 + pre-push 全量門禁）
├── frontend/
│   └── src/
│       ├── api/           ← API 调用函数（JSDoc error 级门禁）
│       ├── composables/   ← 组合式函数（JSDoc warn 级门禁）
│       ├── components/    ← 公共组件
│       ├── constants/     ← 常量与映射工厂（JSDoc warn 级门禁）
│       ├── directives/    ← 自定义指令（JSDoc warn 级门禁）
│       ├── i18n/          ← 国际化（JSDoc warn 级门禁）
│       ├── layouts/       ← 页面布局
│       ├── router/        ← 路由守卫（JSDoc warn 级门禁）
│       ├── stores/        ← Pinia store（JSDoc error 级门禁）
│       ├── styles/        ← 全局样式
│       ├── types/         ← 共享类型声明（strict 规则 + Layer 2 质量检查）
│       ├── utils/         ← 工具函数（JSDoc error 级门禁）
│       └── views/         ← 页面视图（按模块分目录，.vue JSDoc warn 级门禁）
├── backend/
│   └── src/
│       ├── common/        ← 拦截器、过滤器、帮助类（JSDoc warn 级门禁）
│       ├── modules/       ← 业务模块（service/controller JSDoc warn 级门禁）
│       └── migrations/    ← 数据库迁移
├── scripts/               ← 部署、备份、JSDoc 检查等脚本
├── docs/                  ← 项目文档
├── .lintstagedrc.mjs      ← lint-staged 設定（pre-commit 用）
└── package.json           ← 统一 verify 入口
```

---

## 9. 常用命令速查

| 用途 | 命令 |
|------|------|
| 启动前端开发服务 | `npm run dev:frontend` |
| 启动后端开发服务 | `npm run dev:backend` |
| 快速校验 | `npm run verify:fast` |
| 标准校验（含测试） | `npm run verify` |
| 完整校验（含构建） | `npm run verify:full` |
| 前端 lint 自动修复 | `npm run lint:fix --prefix frontend` |
| 后端 lint 自动修复 | `npm run lint:fix --prefix backend` |
| 前端测试（watch） | `npm run test:watch --prefix frontend` |
| 后端测试（覆盖率） | `npm run test:cov --prefix backend` |
| JSDoc 质量检查 | `npm run jsdoc:check` |
| 数据库迁移 | `npm run migration:run --prefix backend` |
| 部署 | `npm run deploy` |

---

## 10. 禁止事项

1. **不要直接修改 `main` 分支上的公共基础文件**（路由配置、全局样式、TypeORM 配置）而不告知原因。
2. **不要在代码中留下假数据、临时开关或未清理的 `TODO`**（`TODO` 保留须附带 issue 号或计划说明）。
3. **不要在 lint / CI 命令中使用 `--fix`**（CI 环境禁止自动修改代码）。
4. **不要跳过校验直接交付** — 所有代码变更必须至少通过 `verify:fast`。
5. **不要提交含密码、密钥、token 的文件**（`.env` 已在 `.gitignore`）。
6. **不要引入未经讨论的新依赖**（尤其是大型框架或 native 模块）。
