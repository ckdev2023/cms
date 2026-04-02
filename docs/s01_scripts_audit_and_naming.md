# S01 — Scripts 盘点与统一 Verify 命名方案

## 1. 现有脚本盘点

### 根目录 `package.json`

| 脚本 | 命令 | 状态 |
|------|------|------|
| `dev:frontend` | `npm run dev --prefix frontend` | ✅ 正常 |
| `dev:backend` | `npm run start:dev --prefix backend` | ✅ 正常 |
| `build:frontend` | `npm run build --prefix frontend` | ✅ 正常 |
| `build:backend` | `npm run build --prefix backend` | ✅ 正常 |
| `test:frontend` | `npm test --prefix frontend` | ✅ 正常 |
| `test:backend` | `npm test --prefix backend` | ✅ 正常 |
| `lint:frontend` | `npm run lint --prefix frontend` | ✅ 正常（**S02 修复**） |
| `lint:backend` | `npm run lint --prefix backend` | ✅ 正常（已修正为无 `--fix`） |
| `deploy` | `bash scripts/deploy.sh` | ⚠️ 无 pre-deploy 校验 |

### Frontend `frontend/package.json`

| 脚本 | 命令 | 状态 |
|------|------|------|
| `dev` | `vite` | ✅ |
| `build` | `vue-tsc -b && vite build` | ✅ 含类型检查 |
| `preview` | `vite preview` | ✅ |
| `type-check` | `vue-tsc --noEmit -p tsconfig.app.json` | ✅ **S01 新增** |
| `test` | `vitest run` | ✅ |
| `test:watch` | `vitest` | ✅ |
| `lint` | `eslint src` | ✅ **S02 新增** |
| `lint:fix` | `eslint src --fix` | ✅ **S02 新増** |

### Backend `backend/package.json`

| 脚本 | 命令 | 状态 |
|------|------|------|
| `build` | `nest build` | ✅ |
| `format` | `prettier --write "src/**/*.ts" "test/**/*.ts"` | ✅ |
| `lint` | `eslint "{src,apps,libs,test}/**/*.ts"` | ✅ **S01 修正** — 去掉 `--fix` |
| `lint:fix` | `eslint "{src,apps,libs,test}/**/*.ts" --fix` | ✅ **S01 新增** — 原 `lint` 行为移至此处 |
| `type-check` | `tsc --noEmit` | ✅ **S01 新增** |
| `test` | `jest` | ✅ |
| `test:watch` / `test:cov` / `test:e2e` | — | ✅ |

## 2. 已识别缺口

| # | 缺口 | 影响 | 对应后续任务 |
|---|------|------|-------------|
| G1 | Frontend 无 ESLint 配置，无 `lint`/`lint:fix` 脚本 | 已在 S02 新增 ESLint 配置与脚本；`verify:fast` 已含前端 lint | ✅ 已解决 |
| G2 | Backend `lint` 原本带 `--fix`，CI 环境下会静默修改代码 | 已在 S01 修正 | ✅ 已解决 |
| G3 | Frontend `type-check` 被嵌入 `build`，无法独立运行 | 已在 S01 新增独立脚本 | ✅ 已解决 |
| G4 | Backend 无独立 `type-check` | 已在 S01 新增 | ✅ 已解决 |
| G5 | 根目录无统一 `verify` 命令 | 已在 S01 新增三层入口 | ✅ 已解决 |
| G6 | 前端代码规范规则集待确定 | 已在 S02 定义基础规则集；`verify:fast` 已加入 `lint:frontend`。S05 可细化规则分级 | ✅ 基础已解决 |
| G7 | 无 JSDoc 检查机制 | 需新增检查脚本并接入 verify 管道 | **S06 ✅** 标准已定义 → S07–S08 |

## 3. 统一 Verify 命名方案

### 三层入口

```
verify:fast   — 快速检查（lint + type-check），适用于 pre-commit / 开发中自查
verify        — 标准检查（lint + type-check + test），适用于 pre-push / ai-deliver
verify:full   — 完整检查（lint + type-check + test + build），适用于 CI / 部署前
```

### 当前实现（S02 完了済み）

```
verify:fast = lint:frontend → lint:backend → type-check:frontend → type-check:backend
verify      = verify:fast   → test:frontend → test:backend
verify:full = verify        → build:frontend → build:backend
```

### JSDoc Gate 接入后的最终状态（S06–S08）

```
verify:fast = lint:frontend → lint:backend → type-check:frontend → type-check:backend → jsdoc:check
verify      = verify:fast   → test:frontend → test:backend
verify:full = verify        → build:frontend → build:backend
```

## 4. 子包命名规约

所有子包（frontend / backend）遵循统一命名：

| 命名 | 用途 | CI 安全 |
|------|------|---------|
| `lint` | 仅报告问题，不修改代码 | ✅ 是 |
| `lint:fix` | 报告并自动修复 | ❌ 仅限本地开发 |
| `type-check` | 独立类型检查，不产出文件 | ✅ 是 |
| `test` | 运行测试 | ✅ 是 |
| `build` | 编译产出 | ✅ 是 |

## 5. 预存问题

- Frontend `type-check` 发现 4 个预存类型错误（`AdminCaseStatusFlow.vue`、`DepositDetailView.vue`、`InvoiceStatusFlow.vue`、`TaxContractStatusFlow.vue`）。
- Frontend `lint` 报告 64 个预存问题（20 errors, 44 warnings）。主要构成：
  - `vue/no-mutating-props` ×13（ProForm.vue — 直接修改 prop 的反模式）
  - `@typescript-eslint/no-empty-object-type` ×7（type 文件中空接口继承）
  - `@typescript-eslint/no-explicit-any` ×34（warning — 渐进清理）
  - 其他 Vue 风格 warning ×10
- Backend `lint`（无 `--fix`）报告约 5,430 个预存问题（主要是 Prettier 格式问题）。
- 这些预存问题需在启用门禁阻断前逐步清理，或在 S21 中制定分阶段启用策略（先 warning 再 error）。
