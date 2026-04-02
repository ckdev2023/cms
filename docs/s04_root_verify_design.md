# S04 — 根目录 verify:fast / verify / verify:full 统一执行链路设计

## 1. 设计目标

在根目录 `package.json` 提供三层递进式校验入口，满足不同场景对速度和覆盖度的需求，同时保证 AI 交付、Git hooks、CI、部署脚本都复用同一套命令，避免"双套口径"。

## 2. 三层入口定义

| 入口 | 包含检查 | 典型场景 | 预计耗时 |
|------|----------|----------|----------|
| `verify:fast` | lint + type-check | pre-commit、开发自查、AI 快速交付 | ~15 s |
| `verify` | verify:fast + test | pre-push、ai-deliver 标准交付 | ~25 s |
| `verify:full` | verify + build | CI 全量门禁、部署前 | ~60 s |

## 3. 当前调用链路

```
verify:fast
  ├── lint:frontend        → npm run lint --prefix frontend
  ├── lint:backend         → npm run lint --prefix backend
  ├── type-check:frontend  → npm run type-check --prefix frontend
  └── type-check:backend   → npm run type-check --prefix backend

verify
  ├── verify:fast          （上述全部）
  ├── test:frontend        → npm test --prefix frontend
  └── test:backend         → npm test --prefix backend

verify:full
  ├── verify               （上述全部）
  ├── build:frontend       → npm run build --prefix frontend
  └── build:backend        → npm run build --prefix backend
```

## 4. 根 package.json 脚本

```jsonc
{
  "verify:fast": "npm run lint:frontend && npm run lint:backend && npm run type-check:frontend && npm run type-check:backend",
  "verify":      "npm run verify:fast && npm run test:frontend && npm run test:backend",
  "verify:full": "npm run verify && npm run build:frontend && npm run build:backend"
}
```

使用 `&&` 串联：任意步骤失败立即中止，后续步骤不再执行。

## 5. 子包脚本依赖

根入口代理的子包脚本必须满足以下约定（已在 S01/S02 确认全部就位）：

| 子包脚本 | Frontend | Backend | CI 安全 |
|----------|----------|---------|---------|
| `lint` | `eslint src` | `eslint "{src,apps,libs,test}/**/*.ts"` | ✅ 仅报告 |
| `lint:fix` | `eslint src --fix` | `eslint ... --fix` | ❌ 仅本地 |
| `lint:ci` | — | `eslint ... --max-warnings 0` | ✅ 零容忍 |
| `type-check` | `vue-tsc --noEmit -p tsconfig.app.json` | `tsc --noEmit` | ✅ |
| `test` | `vitest run` | `jest` | ✅ |
| `build` | `vue-tsc -b && vite build` | `nest build` | ✅ |

## 6. 扩展点

### 6.1 JSDoc 门禁接入 ✅

JSDoc 检查已作为 `verify:fast` 的最后一步接入：

```
verify:fast
  ├── lint:frontend
  ├── lint:backend
  ├── type-check:frontend
  ├── type-check:backend
  └── jsdoc:check
```

### 6.2 CI 严格模式

CI 环境可直接使用 `verify:full`。若需零 warning 策略，可另设 `verify:ci` 替换 `lint:backend` 为 `lint:ci:backend`（已预留 `lint:ci:backend` 代理脚本）。

### 6.3 增量检查

`pre-commit` 场景通过 `lint-staged` 仅对暂存文件执行 lint（`.lintstagedrc.mjs`），而非全量 `verify:fast`。

## 7. 已验证结果

| 脚本 | 是否可执行 | 备注 |
|------|-----------|------|
| `lint:frontend` | ✅ | 报告 22 errors / 44 warnings（预存） |
| `lint:backend` | ✅ | 报告 ~5,430 problems（预存，多为 Prettier） |
| `type-check:frontend` | ✅ | 报告 4 errors（预存） |
| `type-check:backend` | ✅ | 通过 |
| `test:frontend` | ✅ | 10 passed / 1 failed（预存） |
| `test:backend` | ✅ | 234 passed |
| `build:frontend` | — | 依赖 type-check 先通过 |
| `build:backend` | — | 依赖 lint 先通过 |

所有脚本均可正确解析和执行。预存问题的清理计划见 `docs/s19_rollout_order.md`。

## 8. CI Job 切分设计（S16）

### 8.1 设计目标

将 `verify:full` 的全部检查拆为独立 CI Job，使得：

1. PR Checks 一覧に各ジョブが個別の合否行として表示される（特に `code-style` と `jsdoc-gate` を分離）
2. 片方（frontend/backend）の失敗がもう片方の結果を隠蔽しない
3. Job Summary（Markdown テーブル）で構造化された結果を即座に確認可能
4. `jsdoc-gate` 失敗時に PR diff 上にインライン注釈が表示される

### 8.2 ジョブ構成と依存関係

```
install ──┬── code-style     (ESLint + JSDoc Layer 1)
          ├── type-check     (vue-tsc / tsc)
          ├── jsdoc-gate     (JSDoc Layer 2 内容品質)
          ├── test-frontend  (Vitest)
          └── test-backend   (Jest)
                    ↓ 全合格
               build         (vue-tsc -b && vite build / nest build)
```

- `install` → 依存関係キャッシュ共有。後続 5 ジョブが全て並列実行
- `build` → 5 ジョブ全合格を前提条件とし、最後に実行

### 8.3 verify レベルとの対応

| verify レベル | CI ジョブ |
|--------------|-----------|
| `verify:fast` | `code-style` + `type-check` + `jsdoc-gate` |
| `verify` | 上記 + `test-frontend` + `test-backend` |
| `verify:full` | 上記 + `build` |

### 8.4 サブステップ分離パターン

`code-style`・`type-check`・`build` の各ジョブ内では、frontend / backend を個別ステップとして実行する。`continue-on-error: true` を付与し、最終集計ステップで結果を判定する：

```yaml
- name: "Frontend: ESLint"
  id: fe-lint
  continue-on-error: true      # 失敗してもバックエンドへ進む
  run: npm run lint:frontend

- name: "Backend: ESLint"
  id: be-lint
  continue-on-error: true
  run: npm run lint:backend

- name: Aggregate results       # 両方の結果を集計して合否判定
  if: always()
  run: |
    # steps.fe-lint.outcome / steps.be-lint.outcome を参照
    # GITHUB_STEP_SUMMARY に Markdown テーブルを出力
    # いずれかが failure なら exit 1
```

この方式により、frontend が失敗しても backend の結果が必ず可視化される。

### 8.5 JSDoc インライン注釈

`scripts/check-jsdoc.mjs` は環境変数 `GITHUB_ACTIONS` を検出すると、違反を `::error file=...,line=...::` 形式で出力する。これにより PR の diff ビュー上で違反箇所にインライン注釈が表示される。

### 8.6 PR での見え方

PR の Checks タブには以下の 7 行が並ぶ：

| Check 名 | 失敗時に分かること |
|-----------|-------------------|
| Install Dependencies | npm ci 失敗（依存関係不整合） |
| **Code Style (ESLint)** | **ESLint 違反（JSDoc Layer 1 含む）** |
| Type Check (TypeScript) | TypeScript 型エラー |
| **JSDoc Quality Gate** | **JSDoc 内容品質不足（Layer 2）** |
| Test Frontend (Vitest) | フロントエンドテスト失敗 |
| Test Backend (Jest) | バックエンドテスト失敗 |
| Build Verification | ビルドエラー |

`code-style` と `jsdoc-gate` が独立行として表示されるため、「ESLint の構造チェック」と「JSDoc の内容品質チェック」のどちらが原因かを即座に判別できる。

### 8.7 GitHub Required Status Checks 推奨設定

リポジトリの Branch protection rules で以下を required に設定することを推奨：

- `Code Style (ESLint)` — コードスタイル門禁
- `Type Check (TypeScript)` — 型安全門禁
- `JSDoc Quality Gate` — JSDoc 品質門禁
- `Build Verification` — ビルド最終検証（間接的に全ジョブを要求）
