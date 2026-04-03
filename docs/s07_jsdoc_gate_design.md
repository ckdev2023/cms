# S07 — JSDoc 自動検査方案設計

## 概要

本文件描述 JSDoc 门禁的两层自动检查架构，以及与 verify 管道的集成方式。两层检查互补：Layer 1 用 ESLint 插件做存在性与结构校验，Layer 2 用自定义脚本做内容质量校验。

检查标准来源于 S06（`docs/s06_jsdoc_standard.md`），强制范围来源于 S08。

## 两层检查架构

```
┌─────────────────────────────────────────────────────┐
│  Layer 1 — eslint-plugin-jsdoc（存在性 + 结构）        │
│  运行方式：eslint src（已集成到 lint 管道）              │
│                                                     │
│  ✓ 函数/方法是否有 /** ... */ 注释块                   │
│  ✓ 每个参数是否有 @param 及描述                        │
│  ✓ 非 void 函数是否有 @returns 及描述                  │
│  ✓ 描述是否包含中文（S06 语言要求）                     │
├─────────────────────────────────────────────────────┤
│  Layer 2 — scripts/check-jsdoc.mjs（内容质量）         │
│  运行方式：node scripts/check-jsdoc.mjs               │
│                                                     │
│  ✓ 描述有效字符 ≥ 8（去除标点空格后）                    │
│  ✓ 描述不得为空泛词黑名单中的词汇                       │
│  ✓ 含 throw new 的函数须标注 @throws                  │
│  ✓ types / 后端常量文件顶部说明注释存在且质量达标      │
└─────────────────────────────────────────────────────┘
```

## Layer 1：eslint-plugin-jsdoc

### 安装

前端和后端均已安装 `eslint-plugin-jsdoc`，作为 devDependency 加入。

### 规则配置

以下规则默认以 `warn` 级别应用于方法级强制目录；`backend/src/common/dto/`、`backend/src/common/entities/`、`backend/src/modules/admin-case/dto/`、`backend/src/modules/system/entities/` 与 `backend/src/common/helpers/`、`backend/src/common/interceptors/`、`backend/src/common/filters/` 作为后端声明 / 基础目录，采用单独的 `error` 级门禁。

| 规则 | 作用 | 对应 S06 条款 |
|------|------|--------------|
| `jsdoc/require-jsdoc` | 强制范围内函数/方法必须有 JSDoc 块 | §通过条件 #1（存在性） |
| `jsdoc/require-param` | 每个非 `_` 前缀参数须有 `@param` | §通过条件 #3（参数覆盖） |
| `jsdoc/require-param-description` | `@param` 行须有描述文本 | §参数说明 |
| `jsdoc/require-returns` | 非 void 函数须有 `@returns` | §通过条件 #4（返回值覆盖） |
| `jsdoc/require-returns-description` | `@returns` 须有描述文本 | §返回值说明 |
| `jsdoc/match-description` | 描述须包含至少一个中文字符 | §注释块格式规范 — 语言 |

### 目标文件

**前端**（`frontend/eslint.config.mjs`）：

```
src/stores/**/*.ts
src/composables/**/*.ts
src/directives/**/*.ts
src/utils/**/*.ts
src/api/**/*.ts
src/constants/**/*.ts
src/i18n/**/*.ts
src/router/**/*.ts
```

规则选项：
- `FunctionDeclaration: true` — 覆盖 store action、composable 内部函数、工具函数、API 函数
- `minLineCount: 2` — 豁免单行函数（S06 豁免项）
- `checkConstructors: false`

**后端**（`backend/eslint.config.mjs`）：

```
src/common/dto/**/*.ts
src/common/entities/**/*.ts
src/modules/admin-case/dto/**/*.ts
src/modules/system/entities/**/*.ts
src/common/interfaces/**/*.ts
src/modules/**/*.service.ts
src/modules/**/*.controller.ts
src/modules/auth/guards/*.ts
src/common/interceptors/*.ts
src/common/helpers/*.ts
src/common/filters/*.ts
src/migrations/**/*.ts
```

排除 `**/index.ts`（re-export 文件，S06 豁免项）。

规则选项：
- `src/common/dto/**/*.ts`、`src/common/entities/**/*.ts`、`src/modules/admin-case/dto/**/*.ts`、`src/modules/system/entities/**/*.ts`：`ClassDeclaration: true`，等级 **error**
- `src/common/interfaces/**/*.ts`：通过 Layer 2 检查文件顶部说明，`simple-import-sort` 为 **error**
- `src/common/helpers/**/*.ts`、`src/common/interceptors/*.ts`、`src/common/filters/*.ts`：`ClassDeclaration: true` + `FunctionDeclaration: true` + `MethodDefinition: true`，等级 **error**
- `src/migrations/**/*.ts`：`ClassDeclaration: true`，等级 **error**；同时关闭 `prettier/prettier` 与复杂度类规则，避免长 SQL 字符串产生低价值噪音
- 其余后端目录：`FunctionDeclaration: true` + `MethodDefinition: true`，等级 **warn**
- `checkConstructors: false` — 排除空构造函数（S06 豁免项）
- `checkGetters: false` / `checkSetters: false` — 排除简单访问器
- `minLineCount: 2` — 豁免单行方法

### 与现有 lint 管道的关系

jsdoc 规则作为 ESLint 配置的一部分，已自动包含在以下命令中：

- `npm run lint`（前端 / 后端各自的 lint）
- `npm run lint:frontend` / `npm run lint:backend`（根目录代理）
- `npm run verify:fast`（经由上述 lint 步骤）

无需额外调用，Layer 1 即随 lint 一起执行。

## Layer 2：scripts/check-jsdoc.mjs

### 职责

检查 ESLint 规则难以表达的内容质量：

| 检查项 | 规则 | 对应 S06 条款 |
|--------|------|--------------|
| 描述最小长度 | 有效字符（去除标点空格）≥ 8 | §通过条件 #2（摘要有效） |
| 空泛词拦截 | 描述全文匹配黑名单即失败 | §空泛词黑名单 |
| @throws 覆盖 | 函数体含 `throw new` 时须有 `@throws` | §通过条件 #5（异常覆盖） |
| DTO / Entity 类摘要质量 | `common/dto`、`common/entities`、`modules/admin-case/dto` 与 `modules/system/entities` 中类级 JSDoc 摘要须满足最小长度与非空泛描述 | §声明类摘要有效 |
| types 文件顶部说明 | `frontend/src/types/*.ts` 须在文件顶部提供中文说明注释 | §类型文件顶部说明 |
| 后端接口契约文件顶部说明 | `backend/src/common/interfaces/*.ts` 须在文件顶部提供中文说明注释 | §后端接口契约文件顶部说明 |
| 后端常量文件顶部说明 | `backend/src/common/constants/*.ts` 须在文件顶部提供中文说明注释 | §后端常量文件顶部说明 |
| 后端迁移文件顶部说明 | `backend/src/migrations/*.ts` 须在文件顶部提供中文说明注释 | §后端迁移文件顶部说明 |

### 空泛词黑名单

```
处理, 获取, 设置, 执行, 操作, 初始化,
处理数据, 获取信息, 处理请求, 辅助方法,
Helper, Process, Handle, Get data,
Execute, Initialize, Do something
```

单独构成完整描述时视为不合格。包含额外修饰语的不受影响（如 "获取用户列表" 合格）。

### 运行方式

```bash
# 扫描全部强制目录
node scripts/check-jsdoc.mjs

# 仅检查指定文件（lint-staged 模式）
node scripts/check-jsdoc.mjs frontend/src/stores/user.ts backend/src/modules/auth/auth.service.ts
```

传入文件路径时，脚本自动过滤非目标目录的文件。

其中 `frontend/src/types/index.ts`、`backend/src/common/constants/index.ts` 这类纯 re-export 文件自动豁免，不纳入顶部说明检查。

### @throws 检测策略

使用行扫描 + 大括号深度追踪来判断函数体边界内是否存在 `throw new` 语句。此方法为启发式：

- 准确场景：函数直接包含 `throw new XxxException(...)`
- 可能误报：嵌套回调/箭头函数内的 throw（概率低，可接受）
- 不检测场景：`throw error`（非 `throw new`）— 以减少噪音

### 输出格式

```
  frontend/src/utils/foo.ts:12 [doSomething] 描述过短（有效字符 4/8）
  backend/src/modules/auth/auth.service.ts:31 [validateUser] 函数体含 throw new 但 JSDoc 缺少 @throws

❌ JSDoc 質量検査：2 件の問題を検出
```

违规时退出码为 1，通过时为 0。

## 管道集成

### 本地开发

```
verify:fast
  ├── lint:frontend       ← 含 Layer 1 JSDoc 检查
  ├── lint:backend        ← 含 Layer 1 JSDoc 检查
  ├── type-check:frontend
  ├── type-check:backend
  └── jsdoc:check         ← Layer 2 质量检查（新增）
```

根 `package.json` 脚本：

```json
{
  "jsdoc:check": "node scripts/check-jsdoc.mjs",
  "verify:fast": "npm run lint:frontend && npm run lint:backend && npm run type-check:frontend && npm run type-check:backend && npm run jsdoc:check"
}
```

### lint-staged 增量检查（S15 接入）

```json
{
  "*.ts": ["node scripts/check-jsdoc.mjs"]
}
```

脚本接受文件路径参数，自动过滤非目标文件，适合 lint-staged 场景。

### ai-deliver.sh 接入（S14 接入）

```bash
npm run jsdoc:check || { echo "❌ JSDoc 质量检查失败"; exit 1; }
```

### CI 接入（S17–S18 接入）

建议在 CI 中将 JSDoc 检查作为独立 job/step，方便定位失败原因：

```yaml
- name: JSDoc Gate
  run: npm run lint:frontend -- --quiet 2>&1 | grep 'jsdoc/' && npm run jsdoc:check
```

## 当前严重等级

| 层 | 严重等级 | 行为 |
|----|---------|------|
| Layer 1（ESLint） | mixed | `common/dto`、`common/entities`、`modules/system/entities`、`common/helpers`、`common/interceptors`、`common/filters`、`common/interfaces`（import sort）与 `migrations` 为 error；其余强制目录为 warn |
| Layer 2（脚本） | error | 发现违规时退出码 1，阻断 verify:fast |

Layer 2 当前同时承担两类阻断职责：一类是函数/方法 JSDoc 的质量检查，另一类是类型文件、后端接口契约文件与后端常量文件的顶部说明检查。即使文件内没有函数，顶部说明不合格也会阻断 `verify:fast`。

除上述已提前升级的后端公共基础目录外，剩余 Layer 1 从 warn 升级为 error 的具体时间点见 `docs/s19_rollout_order.md` Wave 5。

## 与后续任务的衔接

| 后续任务 | 本方案提供的输入 |
|---------|----------------|
| **S08** — 强制范围确认 | ESLint 的 `files` 配置和脚本的目标目录可按 S08 结论微调 |
| **S14** — ai-deliver.sh | `npm run jsdoc:check` 作为交付闸门步骤 |
| **S15** — pre-commit | Layer 2 脚本支持文件参数，可直接接入 lint-staged |
| **S17/S18** — CI | `jsdoc:check` 作为独立 CI step |
| **S19** — 渐进启用 | 升级 Layer 1 从 warn → error 的时间点（`docs/s19_rollout_order.md` Wave 5） |

## 影响评估

### 前端

ESLint Layer 1 检查覆盖 8 个目录（stores / composables / directives / utils / api / constants / i18n / router），共约 30 个 .ts 文件。预计新增 warn 数量约 70–96 个（每个未注释函数一个）。

### 后端

ESLint Layer 1 检查覆盖 service / controller / guard 文件，以及 `common/dto` / `common/entities` / `modules/system/entities` 声明类、`common/helpers` / `common/interceptors` / `common/filters` 基础设施文件。业务模块目录维持 warn，后端公共基础目录采用 error 级门禁。

### Layer 2 脚本

当前对 59 个文件扫描耗时 < 500ms，不影响开发体验。
