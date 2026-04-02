# Scripts

デプロイ・バックアップ・リストア関連スクリプト。

## 一覧

| スクリプト | 用途 |
|-----------|------|
| `ai-gatekeeper.sh` | AI 前置検査 — 必読ドキュメント案内・フェーズ確認・検証コマンド推奨 |
| `ai-plan.sh` | AI 規画段階の変更影響面分析・S/M/L 自動分級 |
| `ai-deliver.sh` | AI / 人工共通の統一交付門禁（lint・型検査・JSDoc・テスト・ビルド） |
| `check-jsdoc.mjs` | JSDoc 内容品質検査（Layer 2: 空泛語・最小長・@throws 検出） |
| `.husky/pre-commit` | Git pre-commit フック — lint-staged による増分門禁 |
| `deploy.sh` | フロントエンド＋バックエンドのビルド・配置・PM2/Nginx リロード |
| `backup-db.sh` | PostgreSQL 全量バックアップ（pg_dump、30 日保持） |
| `backup-files.sh` | アップロードファイルの NAS 増分同期（rsync） |
| `restore-db.sh` | バックアップからの DB リストア＋整合性検証 |
| `setup-server.sh` | 本番サーバー初期構築（ディレクトリ・ユーザー・crontab） |

## AI 前置検査（ai-gatekeeper.sh）

AI が新しいタスクを開始する前に実行する前置検査スクリプト。  
状態ファイルに依存せず、単独で実行可能。

```bash
# 標準モード — 全 4 セクション出力
bash scripts/ai-gatekeeper.sh

# 簡易モード — 必読ドキュメント + 検証コマンドのみ
bash scripts/ai-gatekeeper.sh --brief
```

出力内容:

```
[1/4] 必読ドキュメント    — AGENTS.md + 各層のドキュメント一覧
[2/4] 現在フェーズの確認  — 8 段階ロードマップと確認促進
[3/4] 開始前チェックリスト — 5 項目の事前確認
[4/4] 検証コマンド        — verify:fast / verify / verify:full + 環境チェック
```

## AI 規画段階（ai-plan.sh）

AI が編集を開始する前に、変更の影響面を分析し S/M/L 級を自動判定するスクリプト。  
状態ファイルに依存せず、単独で実行可能。

```bash
# 自動分析（git diff ベース）— 声明級なし
bash scripts/ai-plan.sh

# S 級を声明して検証
bash scripts/ai-plan.sh S

# 明示的なファイルリストで分析
bash scripts/ai-plan.sh M -- frontend/src/views/customer/CustomerDetailView.vue backend/src/modules/customer/customer.service.ts
```

分級基準:

```
S (Small):  ≤3 ファイル AND 片側（FE or BE のみ）AND ≤1 業務モジュール
M (Medium): 4–10 ファイル OR FE/BE 跨ぎ OR 2–3 業務モジュール OR 公共基盤変更
L (Large):  >10 ファイル OR (FE/BE 跨ぎ AND ≥3 業務モジュール) OR (公共基盤 AND >5 ファイル)
```

出力内容:

```
[1/3] 影響面概要  — ファイル数・FE/BE 跨ぎ・公共基盤・業務モジュール
[2/3] 分級結果    — 自動分析結果 vs 声明級の比較（不一致時は警告）
[3/3] 作業建議    — 級別に応じた推奨ワークフロー
```

終了コード: `0` = 一致（または声明なし）、`1` = 級別低估の警告。

## AI 交付門禁（ai-deliver.sh）

AI およびヒューマン開発者が共通で使用する統一交付ゲート。  
各検査の合否を個別に表示し、失敗原因が埋もれない構造化出力を提供する。

```bash
# fast モード（デフォルト）— lint + 型検査 + JSDoc
bash scripts/ai-deliver.sh

# standard モード — fast + テスト
bash scripts/ai-deliver.sh --standard

# full モード — standard + ビルド
bash scripts/ai-deliver.sh --full
```

実行順序:

```
Phase 1: コードスタイル検査（ESLint）
  ├── Frontend lint
  └── Backend lint
Phase 2: 型検査（TypeScript）
  ├── Frontend type-check
  └── Backend type-check
Phase 3: JSDoc 品質検査
  └── JSDoc quality (Layer 2)
Phase 4: テスト実行（--standard / --full のみ）
  ├── Frontend tests (vitest)
  └── Backend tests (jest)
Phase 5: ビルド検証（--full のみ）
  ├── Frontend build
  └── Backend build
```

`npm run verify:fast` / `verify` / `verify:full` と同じチェックだが、  
各フェーズの合否が個別に可視化される点が異なる。

## 局所門禁コマンド

ディレクトリ単位で段階的に規範を引き上げるため、対象領域だけを素早く確認する入口も用意している。

| コマンド | 対象 | 内容 |
|----------|------|------|
| `npm run lint:api` | `frontend/src/api` | API 呼び出し層の ESLint 阻断級ルール（JSDoc / import sort / 顕式返回型） |
| `npm run verify:api` | `frontend/src/api` | `lint:api` + frontend type-check + API 目录 JSDoc Layer 2 |
| `npm run lint:stores` | `frontend/src/stores` | Pinia store の阻断級ルール |
| `npm run verify:stores` | `frontend/src/stores` | store 向け lint + type-check + JSDoc + テスト |
| `npm run lint:utils` | `frontend/src/utils` | utility 層の阻断級ルール |
| `npm run verify:utils` | `frontend/src/utils` | utility 向け lint + JSDoc |

## Pre-commit Hook（Git 門禁）

`git commit` 実行時に **husky** + **lint-staged** が自動起動し、  
ステージ済みファイルのみを対象に高速な門禁検査を行う。

検査内容:

```
lint-staged
  ├── frontend .ts/.vue → ESLint（JSDoc Layer 1 含む）
  ├── backend .ts       → ESLint（JSDoc Layer 1 含む）
  └── 強制対象 .ts      → check-jsdoc.mjs（Layer 2 品質検査）
```

設定ファイル: `.lintstagedrc.mjs`（リポジトリルート）

特徴:

- **増分検査**: ステージ済みファイルのみ対象のため高速
- **モノレポ対応**: frontend/backend それぞれの ESLint 設定を正しく解決
- **JSDoc 二層**: Layer 1（ESLint 構造チェック）+ Layer 2（内容品質チェック）を同時実行

緊急スキップ:

```bash
git commit --no-verify -m "WIP: 一時コミット"
```

> ⚠️ `--no-verify` は緊急時のみ。交付前に `npm run verify:fast` を必ず実行すること。

初期セットアップ（clone 直後）:

```bash
npm install          # ルートの devDependencies をインストール（husky + lint-staged）
# husky は prepare スクリプトで自動初期化される
```

## Backend 初期化（開発環境）

初回セットアップ:

- `createdb -O postgres jimusho_cms`
- `cd backend && npm run migration:run`
- `cd backend && npm run seed`

日常起動:

- `cd backend && npm run start:dev`

補足:

- `backend/.env` は `DB_SYNCHRONIZE=false` を維持し、スキーマ変更は migration で管理する
- `DB_MIGRATIONS_RUN=true` のため、起動時に未適用 migration があれば自動実行される

## 本番デプロイ

```bash
# 1. デプロイ前に手動 DB バックアップ
./scripts/backup-db.sh

# 2. ビルド＋デプロイ（自動で ai-deliver.sh --standard による門禁検査を実行）
./scripts/deploy.sh

# 3. 動作確認
pm2 status
curl http://127.0.0.1:3000/api/v1/health
```

デプロイ前門禁オプション:

| フラグ | 効果 |
|--------|------|
| _(なし)_ | `ai-deliver.sh --standard`（lint + 型検査 + JSDoc + テスト）を実行後にビルド＋デプロイ |
| `--verify-level=fast` | 門禁を fast（lint + 型検査 + JSDoc のみ）に下げる |
| `--verify-level=full` | 門禁を full（standard + ビルド検証）に上げる |
| `--skip-verify` | 門禁を完全スキップ（緊急時のみ — 品質未保証の成果物が本番に到達する可能性あり） |
| `--skip-build` | ビルド済みアーティファクトを使ってデプロイ（門禁は実行される） |

```bash
# 例: 門禁スキップ＋ビルド済みアーティファクトでデプロイ（緊急ホットフィックス）
./scripts/deploy.sh --skip-verify --skip-build
```

詳細は `docs/18_上線チェックリスト.md` 参照。

## バックアップ

**crontab 設定**（本番サーバー）:

```cron
# DB バックアップ — 毎日 02:00
0 2 * * * /opt/cms/scripts/backup-db.sh >> /var/log/cms/backup-db.log 2>&1

# ファイルバックアップ — 毎日 03:00
0 3 * * * /opt/cms/scripts/backup-files.sh >> /var/log/cms/backup-files.log 2>&1
```

## リストア

```bash
# 検証用 DB にリストア（本番 DB を上書きしない）
./scripts/restore-db.sh /data/backups/db/jimusho_cms_YYYYMMDD_HHMMSS.dump

# 本番 DB にリストア（確認プロンプトあり）
./scripts/restore-db.sh /data/backups/db/jimusho_cms_YYYYMMDD_HHMMSS.dump --target-db jimusho_cms
```

## ロールバック

`docs/19_ロールバック手順書.md` 参照。L1（バックエンドのみ）/ L2（全体）/ L3（DB 含む）の 3 段階。
