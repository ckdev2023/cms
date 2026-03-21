# 事務所管理システム

行政書士 + 税理士事務所向けの内部業務管理後台システム。

## プロジェクト構成

```
├── frontend/    # Vue 3 + TypeScript + Element Plus 管理画面
├── backend/     # NestJS + TypeORM + PostgreSQL API サーバー
├── scripts/     # 初期化・マイグレーション・デプロイ補助スクリプト
└── docs/        # 要件定義・設計・開発ドキュメント
```

## 技術スタック

| レイヤー | 技術 |
| --- | --- |
| フロントエンド | Vue 3, TypeScript, Vite, Element Plus, Pinia, Vue Router |
| バックエンド | Node.js, NestJS, TypeORM |
| データベース | PostgreSQL |
| ファイル管理 | NAS / ローカルディレクトリ + DB メタデータ |
| API | RESTful (`/api/v1`), Swagger/OpenAPI |

## クイックスタート

### 前提条件

- Node.js >= 20
- PostgreSQL >= 15
- npm >= 10

### セットアップ

```bash
# フロントエンド
cd frontend
cp .env.example .env.local
npm install
npm run dev

# バックエンド
cd backend
cp .env.example .env
npm install
npm run start:dev
```

### アクセス

- フロントエンド: http://localhost:5173
- バックエンド API: http://localhost:3000/api/v1
- Swagger ドキュメント: http://localhost:3000/api/docs
```
