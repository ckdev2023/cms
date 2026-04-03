# 事务所管理系统

面向行政书士与税理士事务所的内部业务管理后台。

## 项目结构

```
├── frontend/    # Vue 3 + TypeScript + Element Plus 管理端
├── backend/     # NestJS + TypeORM + PostgreSQL API 服务
├── scripts/     # 初始化、迁移、部署等辅助脚本
└── docs/        # 需求、设计与开发文档
```

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 前端 | Vue 3、TypeScript、Vite、Element Plus、Pinia、Vue Router |
| 后端 | Node.js、NestJS、TypeORM |
| 数据库 | PostgreSQL |
| 文件管理 | NAS / 本地目录 + 数据库元数据 |
| API | RESTful（`/api/v1`）、Swagger/OpenAPI |

## 快速开始

### 环境要求

- Node.js >= 20
- PostgreSQL >= 15
- npm >= 10

### 安装与启动

```bash
# 前端
cd frontend
cp .env.example .env.local
npm install
npm run dev

# 后端
cd backend
cp .env.example .env
npm install
npm run start:dev
```

### 访问地址

- 前端：http://localhost:5173
- 后端 API：http://localhost:3000/api/v1
- Swagger 文档：http://localhost:3000/api/docs
