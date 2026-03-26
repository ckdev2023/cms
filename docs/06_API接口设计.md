# 事务所管理系统 API 接口设计

## 1. 文档目标

本文用于为前后端开发提供统一接口基线。

本项目定位为内部小型 CMS，因此接口设计遵循：

- 简单直接
- REST 风格为主
- 优先满足列表、详情、录入、编辑、删除
- 便于前端管理后台快速开发

## 2. 接口设计原则

### 2.1 基本约定

- 接口前缀：`/api/v1`
- 传输格式：`application/json`
- 文件上传：`multipart/form-data`
- 时间字段统一使用 ISO 8601
- 删除优先采用软删除

### 2.2 返回结构建议

建议统一返回：

- `code`：业务状态码，`0` 表示成功
- `message`：提示信息
- `data`：业务数据

列表接口建议统一返回：

- `items`
- `page`
- `pageSize`
- `total`

### 2.3 查询参数建议

- `page`
- `pageSize`
- `keyword`
- `status`
- `ownerUserId`
- `startDate`
- `endDate`
- `sortBy`
- `sortOrder`

## 3. 鉴权与会话

一期建议采用简单登录方式：

- 账号密码登录
- 登录成功后返回 token 或 session
- 所有业务接口校验当前登录用户

最少保留以下接口：

| 接口 | 方法 | 说明 |
| --- | --- | --- |
| `/auth/login` | POST | 登录 |
| `/auth/logout` | POST | 退出登录 |
| `/auth/me` | GET | 获取当前用户信息 |
| `/auth/change-password` | PUT | 修改密码 |

## 4. 模块接口设计

### 4.1 工作台

| 接口 | 方法 | 说明 |
| --- | --- | --- |
| `/dashboard/summary` | GET | 获取工作台汇总信息 |
| `/dashboard/todos` | GET | 获取待办列表 |
| `/dashboard/deadlines` | GET | 获取即将到期事项 |
| `/dashboard/recent-customers` | GET | 获取最近访问客户 |

### 4.2 客户中心

#### 核心接口

| 接口 | 方法 | 说明 |
| --- | --- | --- |
| `/customers` | GET | 客户列表 |
| `/customers` | POST | 新建客户 |
| `/customers/{id}` | GET | 客户详情 |
| `/customers/{id}` | PUT | 编辑客户 |
| `/customers/{id}` | DELETE | 删除客户（软删除） |
| `/customers/{id}/notes` | GET | 客户跟进记录列表 |
| `/customers/{id}/notes` | POST | 新增客户跟进记录 |
| `/customers/{id}/overview` | GET | 客户总览数据 |

#### 客户列表建议支持筛选

- 客户名称
- 客户类型
- 服务类型
- 负责人
- 状态

#### 客户详情建议聚合返回

- 客户基础信息
- 法人 / 个人附加信息
- 行政案件摘要
- 税务业务摘要
- 财务摘要
- 文件摘要
- 最近跟进记录

### 4.3 行政书士事务模块

| 接口 | 方法 | 说明 |
| --- | --- | --- |
| `/admin-cases` | GET | 行政案件列表 |
| `/admin-cases` | POST | 新建行政案件 |
| `/admin-cases/{id}` | GET | 行政案件详情 |
| `/admin-cases/{id}` | PUT | 编辑行政案件 |
| `/admin-cases/{id}` | DELETE | 删除行政案件 |
| `/admin-cases/{id}/interviews` | GET | 面谈记录列表 |
| `/admin-cases/{id}/interviews` | POST | 新增面谈记录 |
| `/admin-cases/{id}/tasks` | GET | 关联任务列表 |

建议筛选字段：

- 客户
- 案件状态
- 在留资格
- 到期日
- 负责人

### 4.4 税理士模块

#### 合同接口

| 接口 | 方法 | 说明 |
| --- | --- | --- |
| `/tax-contracts` | GET | 税务合同列表 |
| `/tax-contracts` | POST | 新建税务合同 |
| `/tax-contracts/{id}` | GET | 税务合同详情 |
| `/tax-contracts/{id}` | PUT | 编辑税务合同 |

#### 月次接口

| 接口 | 方法 | 说明 |
| --- | --- | --- |
| `/tax-periods` | GET | 月次列表 |
| `/tax-periods` | POST | 新建月次记录 |
| `/tax-periods/{id}` | GET | 月次详情 |
| `/tax-periods/{id}` | PUT | 编辑月次状态 |
| `/tax-periods/{id}/documents` | GET | 月次资料列表 |
| `/tax-periods/{id}/documents` | POST | 上传月次资料 |

建议筛选字段：

- 客户
- 期间
- 月次状态
- 资料状态
- 申报截止日

### 4.5 财务中心

#### 请款接口

| 接口 | 方法 | 说明 |
| --- | --- | --- |
| `/invoices` | GET | 请款单列表 |
| `/invoices` | POST | 新建请款单 |
| `/invoices/{id}` | GET | 请款单详情 |
| `/invoices/{id}` | PUT | 编辑请款单 |
| `/invoices/{id}/void` | POST | 作废请款单 |

#### 收款接口

| 接口 | 方法 | 说明 |
| --- | --- | --- |
| `/payments` | GET | 收款列表 |
| `/payments` | POST | 登记收款 |
| `/payments/{id}` | GET | 收款详情 |
| `/payments/{id}/reverse` | POST | 冲正收款 |

#### 预收款接口

| 接口 | 方法 | 说明 |
| --- | --- | --- |
| `/deposit-accounts` | GET | 预收款账户列表 |
| `/deposit-accounts/{customerId}` | GET | 客户预收款账户详情 |
| `/deposit-transactions` | GET | 预收款流水列表 |
| `/deposit-transactions` | POST | 登记预收款充值/抵扣 |

财务接口建议额外处理：

- 防重复提交
- 保留操作日志
- 删除改为作废或冲正

### 4.6 文件中心

| 接口 | 方法 | 说明 |
| --- | --- | --- |
| `/files` | GET | 文件列表 |
| `/files/upload` | POST | 上传文件 |
| `/files/{id}` | GET | 获取文件元数据 |
| `/files/{id}/download` | GET | 下载文件 |
| `/files/{id}` | DELETE | 删除文件 |

建议文件筛选字段：

- 所属客户
- 所属模块
- 文件分类
- 上传人
- 上传时间

### 4.7 任务与审批

虽然审批是一期可简化能力，但建议预留接口：

| 接口 | 方法 | 说明 |
| --- | --- | --- |
| `/tasks` | GET | 任务列表 |
| `/tasks` | POST | 新建任务 |
| `/tasks/{id}` | PUT | 编辑任务 |
| `/approvals` | GET | 审批单列表 |
| `/approvals` | POST | 发起审批 |
| `/approvals/{id}/approve` | POST | 审批通过 |
| `/approvals/{id}/reject` | POST | 审批驳回 |

### 4.8 系统设置

| 接口 | 方法 | 说明 |
| --- | --- | --- |
| `/users` | GET | 用户列表 |
| `/users` | POST | 新建用户 |
| `/users/{id}` | GET | 用户详情 |
| `/users/{id}` | PUT | 编辑用户 |
| `/users/{id}/enable` | POST | 启用用户 |
| `/users/{id}/disable` | POST | 停用用户 |
| `/roles` | GET | 角色列表 |
| `/roles` | POST | 新建角色 |
| `/roles/{id}` | PUT | 编辑角色 |
| `/dictionaries` | GET | 基础字典列表 |

### 4.9 日志接口

| 接口 | 方法 | 说明 |
| --- | --- | --- |
| `/audit-logs` | GET | 操作日志列表 |
| `/login-logs` | GET | 登录日志列表 |
| `/export-logs` | GET | 导出日志列表 |

## 5. 页面与接口映射建议

### 5.1 客户详情页

建议首屏请求：

- `/customers/{id}`
- `/customers/{id}/overview`

标签页按需加载：

- 行政案件
- 税务月次
- 财务记录
- 文件列表
- 跟进记录

### 5.2 工作台

建议拆成多个轻接口，避免一个大接口过重：

- 汇总卡片
- 待办列表
- 到期提醒
- 最近访问

## 6. 开发优先级建议

### P0 先开发

- 登录
- 工作台基础接口
- 客户模块
- 行政案件模块
- 税务合同 / 月次模块
- 请款 / 收款 / 预收款模块
- 文件上传 / 下载 / 列表
- 用户管理

### P1 再开发

- 审批
- 导出日志
- 操作日志查询
- 字典管理

## 7. 接口文档管理建议

建议使用 Swagger / OpenAPI 自动生成接口文档，并在开发时统一：

- 请求 DTO
- 返回 DTO
- 枚举定义
- 分页结构

这样前后端联调会更顺畅。

## 8. 结论

本项目 API 设计不追求复杂，而是要做到：

- 模块边界清晰
- 命名统一
- 前端好接入
- 后端好维护

一句话总结：**接口要够用、稳定、容易联调。**