# Scripts

デプロイ・バックアップ・リストア関連スクリプト。

## 一覧

| スクリプト | 用途 |
|-----------|------|
| `deploy.sh` | フロントエンド＋バックエンドのビルド・配置・PM2/Nginx リロード |
| `backup-db.sh` | PostgreSQL 全量バックアップ（pg_dump、30 日保持） |
| `backup-files.sh` | アップロードファイルの NAS 増分同期（rsync） |
| `restore-db.sh` | バックアップからの DB リストア＋整合性検証 |
| `setup-server.sh` | 本番サーバー初期構築（ディレクトリ・ユーザー・crontab） |

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

# 2. ビルド＋デプロイ
./scripts/deploy.sh

# 3. 動作確認
pm2 status
curl http://127.0.0.1:3000/api/v1/health
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
