# 签证客户中心 P0 验收与 Rollout 说明

> **文档定位**：签证客户中心 P0 阶段的收口文档。包含职责边界、兼容说明、验收矩阵与 P1/P2 延续项。
> 以后若口径变更，必须先改 `签证客户中心计划优化` 计划文件，再动 schema / API / UI。

---

## 1. 职责边界

### 1.1 签证域与既有模块的边界

| 维度 | 签证域（本轮新增） | 客户中心（既有） | 行政案件（既有） |
|------|---------------------|------------------|-----------------|
| **主对象** | `visa_cases` | `customers` | `admin_cases` |
| **从属关系** | 案件挂在客户下 `customer_id` | 独立主档 | 案件挂在客户下 |
| **日志/备注** | 案件日志：`notes.visa_case_id IS NOT NULL` | 客户备注：`notes.visa_case_id IS NULL` | 独立面谈/任务 |
| **文件** | `customer_file_paths`（路径台账，非上传） | `files`（上传附件） | `admin_case_documents` |
| **提醒** | `visa-reminders`（基于 `expire_date`） | 主档在留日 `person_info.residence_expire_date` 仅在 **详情/列表派生** 展示；**无**独立 90 天聚合列表 API/页（**§1.5**） | 无独立提醒 |
| **权限前缀** | `visaCase:*` / `visaCaseLog:*` / `customerFilePath:*` / `visaReminder:*` | `customer:*` | `admin_case:*` |
| **菜单入口** | 客户详情签证域 Tab + 签证工作台 `/workbench/visa` + 独立签证提醒页 + 全局案件登记（P1-S4e）；侧栏入口层级 **§5.4** | 客户列表 + 客户详情；侧栏上客户列表为 **客户中心 hub** 内扁平项（**§5.4**） | 行政案件列表 + 详情；侧栏入口在 hub 内与签证主路径 **同一层扁平列表**（依权限，**§5.4**） |

### 1.2 签证域内部职责划分

| 子域 | 说明 |
|------|------|
| **签证案件** | 以 `visa_cases` 为主表，承载案件类型、状态、家庭签模式、负责人、到期/跟进、材料/费用摘要。 |
| **家属关联** | `visa_case_family_members` 记录案件级主申请人与家属关系，独立于 `person_info.primary_customer_id` 客户主档层家族关系。 |
| **案件日志** | 复用 `notes` 表，以 `visa_case_id IS NOT NULL` + `log_type` 区分，不新建第二张日志主表。 |
| **资料路径台账** | `customer_file_paths` 记录服务器文件路径，不承载上传功能；与 `files`（上传附件）互为补充。 |
| **签证提醒** | 四类提醒桶（补件 > 今日待跟进 > 7天内到期 > 2个月内到期），基于 `expire_date` 计算；与客户主档在留日 **并行**（**§6.4**），主路径见 **§1.5**。 |

### 1.3 不做 / 明确不在 P0 范围的事项

- 完整材料 checklist 数据模型与可编辑 UI
- 客户备注与案件日志混合总时间线
- 旧客户建档流程替换
- **「创建新档案」主路径（2026-04-05，与 `docs/31` §7 一致）**：产品确认为 **(a) 保持**「新建客户 → 客户详情 → 签证 Tab 建案」**两步主路径**；**(c) 允许** 在同一路径下加强引导（文案、成功后续步、**不改变上述顺序** 的快捷入口/深链等），**不** 视为「旧客户建档流程替换」。**(b) 列表/弹窗级「客户 + 首案」合并向导** 若作为 **替代上述顺序的默认主路径** 落地，仍属本节「替换」范围，**须先修订本节并单独排期**。
- 旧在留提醒页替换
- `admin_cases` 向签证域的统一迁移（**P2** 亦不采用「单域强统一」；并列策略与可选人工补录边界见 **`docs/29_P2-S3c_行政案件与签证域策略口径冻結.md`**）
- 行级数据权限（仅本人负责过滤）
- 工作台/首页看板
- `material_status` 自动推导（P0 先手工维护）

### 1.4 客户备注与案件日志（跟进写哪里）— 产品冻结

| 对象 | 边界 | 约定 |
|------|------|------|
| **客户备注** | `notes.visa_case_id IS NULL`；`NoteType`（跟进 / 备忘 / 通用等） | **轻量备忘**，不要求具备案件日志同款结构化字段（已提交材料、缺失材料、下一步动作、下次跟进时间等）。 |
| **案件日志** | `notes.visa_case_id IS NOT NULL`；`VisaCaseLogType` 等 | **业务过程跟进与交接的权威载体**，须使用结构化字段（与本文 §2.2、`CreateVisaCaseLogDto` 一致）。 |

**结论（2026-04-04）**：不要求把客户备注升级为与案件日志同构；**一线业务跟进须写案件日志**，避免双写。若未来要改此分工，须先修订本文档再动 schema / API / UI。

### 1.5 客户主档在留（person_info）与「90 天」聚合视图 — 产品冻结

> **交叉引用**：选项表与变更流程以 **`docs/17` §1.10** 为细则权威；本节为签证客户中心收口文档中的 **摘要锚点**。主档在留 **数据字段** 与案件到期 **并行、互不替代** 的原则仍见 **§6.4**。

针对 GAP 叙事中「**约 90 天内到期的个人在留统一列表**」类能力，产品 **三选一** 结论为：

| 方案 | 结论 |
| --- | --- |
| 恢复独立在留列表页（旧 `/customers/residence-reminders`）+ 专用聚合 API | **不做**（当前发版已移除对应路由与 **`GET /customers/residence-expiry-reminders`**）。 |
| 客户列表增加在留到期区间筛选（如 `residenceExpireWithinDays`） | **本期不做**；若强依赖须先修订 `docs/17` §1.10 与本节再排期。 |
| **仅依赖签证工作台、签证提醒 + 客户详情与列表派生展示** | **✅ 已选**。主路径：**`/workbench/visa`**、**`/visa-reminders`**（案件维度）；主档在留在 **客户详情** 维护并在 **列表/详情** 通过既有 **`alertLevel` / `visaDerivedRisk`** 等辅助识别。 |

**旧书签说明**：`/customers/residence-reminders` **不再**注册为独立页，可能被 `customers/:id` 误匹配为非 UUID；应改用 **`/workbench/visa`** 或 **`/visa-reminders`**（依权限）。

### 1.6 客户列表「主展示案件」选取与排序 — 产品冻结

> **交叉引用**：可执行规则（含 NULL 处理与 tie-break）以 **`docs/17` §1.11** 为权威；本节为收口摘要。

- **是否落列**：客户列表增加「主展示案件」摘要列属 **实现排期**，但 **一旦实现** 须遵守下列选取逻辑。
- **候选与终态**：`COMPLETED` / `CANCELLED` 为已结案；优先在 **未结案** 集合中选；若无未结案，则在 **全部** 案件中取 **最近更新** 一条作只读摘要。
- **排序键**（未结案集合内）：`next_follow_up_at` **升序**（`NULL` 置后）→ `expire_date` **升序**（`NULL` 置后）→ `updated_at` **降序** → `id` **降序**。
- **负责人**：**不参与** 主选取键（避免同一列表因当前用户不同而换行）；「是否我负责」仅可作 UI 高亮。

**结论**：与 `docs/17` §1.11 同步冻结（2026-04-04）。

### 1.7 产品开发门禁（修订优先于编码）

以下能力若与 **已冻结** 主路径或数据分工 **冲突**，**必须先修订** `docs/21` 相关小节 **与** `docs/17` 对应条款（含变更记录），再排开发与验收；**禁止**以「仅改代码」方式绕过文档。

| 门禁项 | 权威文档位置 | 摘要 |
| --- | --- | --- |
| **替代**「新建客户 → 客户详情 → 签证 Tab 建案」的 **默认主路径**（含列表/弹窗级「客户 + 首案」合并向导若作为默认替代） | **§1.3** | 允许加强引导与深链；**不允许**在未修订前把合并向导升为默认主路径 |
| **恢复**独立在留聚合列表页 / **`GET /customers/residence-expiry-reminders`** | **§1.5**、`docs/17` §1.10 | 当前已选「工作台 + 签证提醒 + 列表/详情派生」 |
| **客户备注与案件日志合并**为单一时间线或同构升级 | **§1.4**、`docs/17` §1.9 | 跟进权威载体为 **案件日志**；备注为轻量备忘 |
| 其他与本节 §1.3–§1.6 **直接矛盾** 的产品变更 | 同上 + `docs/17` | 一律 **文档先行** |

---

## 2. 数据模型与表结构

### 2.1 新增表

| 表名 | 说明 | 对应 Entity |
|------|------|-------------|
| `visa_cases` | 签证案件主表 | `VisaCase` |
| `visa_case_family_members` | 案件级家属关联 | `VisaCaseFamilyMember` |
| `customer_file_paths` | 客户/案件资料路径台账 | `CustomerFilePath` |

**P1/P2 增补表**（实现以 `backend/src/migrations/*.ts` 为准；下列为文档对账摘要）：

| 表名 | 说明 | 对应 Entity / 备注 |
|------|------|---------------------|
| `material_checklist_templates` 等 | 材料 checklist 模板与实例 | 见 **`docs/22_材料チェックリスト口径冻結.md`** |
| `visa_case_import_batches` | 历史 CSV 导入批次登记（`content_sha256` 幂等） | 与 **`docs/23`** §6.4 一致 |
| `teams` | 签证域「团队」数据范围可配置成员集合之主表 | `Team`（`backend/src/modules/auth/entities/team.entity.ts`） |
| `team_users` | 用户—团队多对多关联 | 联合主键 `(team_id, user_id)` |
| `admin_case_visa_supplement_batches` | 行政案件→签证域补录批次（所选行政 ID 集合 SHA 幂等） | `AdminCaseVisaSupplementBatch` |

### 2.2 扩展表

| 表名 | 新增字段 | 说明 |
|------|---------|------|
| `notes` | `visa_case_id`, `log_type`, `submitted_items`, `missing_items`, `next_action`, `next_follow_up_at` | 支持案件日志 |

### 2.3 核心枚举

| 枚举 | 值 |
|------|----|
| `VisaCaseStatus` | `DRAFT`, `IN_PROGRESS`, `SUBMITTED`, `SUPPLEMENT`, `APPROVED`, `REJECTED`, `COMPLETED`, `CANCELLED` |
| `VisaCaseLogType` | `SUBMISSION`, `SUPPLEMENT`, `FOLLOW_UP`, `STATUS_CHANGE`, `GENERAL` |
| `VisaCaseMemberRole` | `APPLICANT`, `SPOUSE`, `CHILD`, `PARENT`, `OTHER` |
| `FamilyLinkMode` | `INTERNAL`, `EXTERNAL` |
| `FilePathType` | `CASE_DOCUMENT`, `PERSONAL_DOCUMENT`, `CERTIFICATE`, `CONTRACT`, `OTHER` |
| `VisaCaseFeeStatus` | `NOT_BILLED`, `BILLED`, `PARTIAL_PAID`, `PAID` |
| `VisaReminderType` | `SUPPLEMENT`, `TODAY_FOLLOW_UP`, `EXPIRING_7_DAYS`, `EXPIRING_2_MONTHS` |
| `MaterialStatus`（复用） | `NOT_RECEIVED`, `PARTIAL`, `COMPLETE` |

### 2.4 Migrations

| 文件 | 内容 |
|------|------|
| `1775500000000-CreateVisaCaseTables.ts` | 创建 `visa_cases`, `visa_case_family_members` 表与索引 |
| `1775600000000-ExtendNotesForVisaCaseLog.ts` | 扩展 `notes` 表支持案件日志字段 |
| `1775700000000-AddVisaCaseCoreFieldsAndFilePathTable.ts` | 补齐案件核心字段，创建 `customer_file_paths` 表 |
| `1775800000000-CreateMaterialChecklistTables.ts` | 材料 checklist 模板与实例（P1-S1） |
| `1775900000000-AddVisaCaseImportReference.ts` | `import_reference` 行级幂等键（P1-S3） |
| `1776000000000-CreateVisaCaseImportBatchTable.ts` | 历史导入批次与内容 SHA 登记（P1-S3） |
| `1776100000000-AddVisaCaseListFilterIndexes.ts` | 跨客户案件列表筛选用部分索引（P1-S4b） |
| `1776200000000-CreateTeamsAndTeamUserMembership.ts` | 创建 `teams`、`team_users`（P2-S2b 团队数据范围持久化） |
| `1776300000000-AddVisaDataScopePerfIndexes.ts` | `visa_cases` / `notes` 上与 `mine`/`team`/客户 EXISTS 相关的部分索引（P2-S2f，说明见 **`docs/27`**） |
| `1776400000000-CreateAdminCaseVisaSupplementBatchTable.ts` | 创建 `admin_case_visa_supplement_batches`（P2-S3d 补录批次 SHA 去重） |
| `1776500000000-AddVisaCaseImportBatchesCreatedAtIndex.ts` | `visa_case_import_batches.created_at DESC` 索引（批次只读列表按时间分页，与 **`docs/23`** §6.4 对账场景一致） |

---

## 3. API 接口清单

### 3.1 新增接口

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| `POST` | `/customers/:customerId/visa-cases` | `visaCase:create` | 在客户上下文创建签证案件 |
| `GET` | `/customers/:customerId/visa-cases` | `visaCase:list` | 客户名下案件列表 |
| `GET` | `/visa-cases` | `visaCase:list` | 跨客户案件分页列表（P1-S4b；Query 见 `docs/25` §9） |
| `GET` | `/visa-cases/stats` | `visaCase:list` | 签证域只读统计 KPI（P1-S4c；Query 见 `QueryVisaCaseStatsDto`） |
| `GET` | `/visa-cases/:id` | `visaCase:detail` | 案件详情 |
| `PUT` | `/visa-cases/:id` | `visaCase:edit` | 更新案件 |
| `GET` | `/visa-cases/:visaCaseId/family-members` | `visaCase:detail` | 案件家属列表 |
| `POST` | `/visa-cases/:visaCaseId/family-members` | `visaCase:edit` | 添加家属 |
| `PUT` | `/visa-cases/:visaCaseId/family-members/:memberId` | `visaCase:edit` | 更新家属 |
| `DELETE` | `/visa-cases/:visaCaseId/family-members/:memberId` | `visaCase:edit` | 移除家属 |
| `POST` | `/visa-cases/:visaCaseId/logs` | `visaCaseLog:create` | 创建案件日志 |
| `GET` | `/visa-cases/:visaCaseId/logs` | `visaCase:detail` | 案件日志列表 |
| `GET` | `/visa-cases/:visaCaseId/logs/:logId` | `visaCase:detail` | 日志详情 |
| `PUT` | `/visa-cases/:visaCaseId/logs/:logId` | `visaCaseLog:edit` | 更新日志 |
| `DELETE` | `/visa-cases/:visaCaseId/logs/:logId` | `visaCaseLog:delete` | 删除日志（逻辑） |
| `POST` | `/customers/:customerId/file-paths` | `customerFilePath:create` | 创建资料路径 |
| `GET` | `/customers/:customerId/file-paths` | `customerFilePath:list` | 客户路径列表 |
| `GET` | `/visa-cases/:visaCaseId/file-paths` | `customerFilePath:list` | 案件路径列表 |
| `PUT` | `/file-paths/:id` | `customerFilePath:edit` | 更新路径 |
| `DELETE` | `/file-paths/:id` | `customerFilePath:delete` | 删除路径（逻辑） |
| `GET` | `/visa-reminders` | `visaReminder:list` | 签证提醒聚合列表 |
| `GET` | `/workbench/visa` | `visaReminder:list` **或** `visaCase:list`（命中其一） | 签证工作台只读聚合：`stats` 与 `GET /visa-cases/stats` 同源；`reminderPreviews` 为四类提醒桶各 Top N，规则与 `GET /visa-reminders` 一致（P2-S1b） |

### 3.2 保留不变的接口

| 方法 | 路径 | 说明 |
|------|------|------|
| 全套 | `/customers/{customerId}/notes` | 客户备注 CRUD（`visa_case_id IS NULL`） |
| ~~`GET`~~ | ~~`/customers/residence-expiry-reminders`~~ | **（已移除，2026-04-04）** 曾用于旧在留聚合列表；产品冻结见 **§1.5** / `docs/17` §1.10 |
| 全套 | `/customers/*` | 客户 CRUD、概览、列表 |
| 全套 | `/admin-cases/*` | 行政案件全部接口 |
| 全套 | `/files/*` | 文件上传/下载/删除 |

**Phase B 补充（操作审计导出，与 `docs/35` 一致）**：

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| `GET` | `/logs/audit/export.csv` | `log:list` | 按与 `GET /logs/audit` 相同的筛选导出 CSV（默认最多 2000 行，最大 5000），并写入 `export_logs`（`AUDIT_LOG_CSV`） |

---

## 4. 权限矩阵

### 4.1 新增权限码

| 权限码 | 管理者 | 业务员工 | 财务人员 |
|--------|--------|---------|---------|
| `visaCase:list` | ✅ | ✅ | ✅（只读） |
| `visaCase:detail` | ✅ | ✅ | ✅（只读） |
| `visaCase:create` | ✅ | ✅ | ❌ |
| `visaCase:edit` | ✅ | ✅ | ❌ |
| `visaCaseLog:create` | ✅ | ✅ | ❌ |
| `visaCaseLog:edit` | ✅ | ✅ | ❌ |
| `visaCaseLog:delete` | ✅ | ✅ | ❌ |
| `customerFilePath:list` | ✅ | ✅ | ✅（只读） |
| `customerFilePath:create` | ✅ | ✅ | ❌ |
| `customerFilePath:edit` | ✅ | ✅ | ❌ |
| `customerFilePath:delete` | ✅ | ✅ | ❌ |
| `visaReminder:list` | ✅ | ✅ | ✅（只读） |

### 4.2 种子数据

权限已在 `backend/src/seeds/seed.ts` 中注册。角色分配：

- **管理者**：`visaCase:*` + `visaCaseLog:*` + `customerFilePath:*` + `visaReminder:list`（全量）
- **业务员工**：同管理者（P0 宽口径，不做负责人过滤）
- **财务人员**：`visaCase:list` + `visaCase:detail` + `visaReminder:list` + `customerFilePath:list`（只读）

### 4.3 进入方式

- 客户详情签证域 Tab：依附 `customer:detail` 进入，编辑动作叠加签证子权限控制。
- 签证提醒页：侧栏入口位于 **客户中心 hub** 内（与 `/customers`、工作台等 **同一层扁平项**，无「签证业务」二级标题）；路由 **`/visa-reminders` 不变**（见 **§5.4**、**§14.1**），需 `visaReminder:list` 权限。

---

## 5. 前端路由与菜单

### 5.1 新增路由

| 路径 | 组件 | 权限 |
|------|------|------|
| `/workbench/visa` | `VisaWorkbenchView.vue` | `visaReminder:list` 与 `visaCase:list` **二选一**（前端路由守卫与后端 `@Permissions` 均为「命中任一」） |
| `/visa-reminders` | `VisaReminderListView.vue` | `visaReminder:list` |
| `/visa-cases` | `VisaCaseRegistryView.vue` | `visaCase:list`（P1-S4：全局跨客户案件列表 / 登记页） |

### 5.2 客户详情签证域

以 Tab 形式嵌入 `CustomerDetailView.vue`，不新增独立路由。Tab 内含：

| 区块 | 组件 |
|------|------|
| 签证域聚合（外壳） | `CustomerVisaDomainTab.vue` |
| 签证案件列表 | `CustomerVisaCasesTab.vue` |
| 案件编辑弹窗 | `CustomerVisaCaseDialog.vue` |
| 创建/补录向导 | `CustomerVisaCaseWizard.vue` |
| 家属成员 | `CustomerFamilyMembersBlock.vue` |
| 资料路径 | `CustomerFilePathsTab.vue` |
| 案件日志 | `CustomerVisaCaseLogsTab.vue` |

### 5.3 保留的旧路由

| 路径 | 说明 |
|------|------|
| ~~`/customers/residence-reminders`~~ | **（已移除，2026-04-04）** 曾计划在留到期提醒独立页；产品主路径见 **§1.5**（`/workbench/visa`、`/visa-reminders`） |
| `/customers` | 客户列表，不受影响 |
| `/customers/:id` | 客户详情，新增签证域 Tab，不破坏原有 Tab |

### 5.4 侧栏信息架构（客户中心 hub）

与 `frontend/src/layouts/MainLayout.vue`、`frontend/src/layouts/main-layout-menu.config.ts` 一致，**不**再将「客户列表」与「签证 / 在留与行政」作为多个 **并列顶级** 侧栏入口：

- **单一顶级**「客户中心」（i18n：`routes.customers`）对应一个 `el-sub-menu`（内部 index 为配置常量 `VISA_MENU_GROUP_INDEX`，**非**浏览器 URL）。
- **其下为单层扁平 `children`**：具备相应权限时，依次为 **`el-menu-item`**（例如 `/customers` → 签证主路径项 → 在留主档/行政案件等），**无**「签证业务」「在留与行政案件」二级子菜单标题；顺序与集合以 `main-layout-menu.config.ts` 为准。
- **默认展开**：冷启动时 **客户中心 hub** 默认展开（`default-openeds` 含 `VISA_MENU_GROUP_INDEX`），便于一览全部子项；与旧版「主路径子分组展开、旧入口子分组折叠」相比，扁平后不再依赖嵌套 `el-sub-menu` 折叠态（`docs/26` S5a 若仍提子分组，以本节为 UI 实现准绳）。

**路由 path 不变**：`/customers`、`/visa-reminders`、`/workbench/visa`、`/admin-cases` 等与 **§14.1** 深链表一致，仅 **导航层级** 收束到客户中心 hub 之下。

---

## 6. 兼容说明

### 6.1 零破坏性变更

以下能力在签证域上线后**保持不变**，不应出现回归：

| 模块 | 兼容项 | 说明 |
|------|--------|------|
| 客户列表 | 查询、筛选、分页 | P1-S4d/S4g 增加可选派生风险筛选与只读列 `visaDerivedRisk`；不传 `visaReminderBucket` 时筛选语义与升级前一致（验收与权限见 `docs/25_P1签证域筛选统计口径冻結.md` §12） |
| 客户详情 | 基本信息、联系方式、旧 Tab | 签证域为新增 Tab，不修改既有 Tab |
| 客户备注 | CRUD `/customers/{id}/notes` | `visa_case_id IS NULL` 条件继续隔离客户备注 |
| 旧在留提醒（独立列表） | — | **已下线**（**§1.5**）：无独立页与 `GET /customers/residence-expiry-reminders`；主档在留日仍在 **客户详情** 维护 |
| 行政案件 | 列表、详情、面谈、任务 | **`admin_cases` 与 `visa_cases` 为并列主表**，`/admin-cases/*` 与签证域 API **独立**；P2 **不**做统一数据迁移。导航/入口层弱合并（P2-S3e）**不**改变本条数据与契约边界（**策略冻結见 `docs/29`、摘要见本文 §19**） |
| 税务合同 | 列表、详情、月次处理 | 独立模块，无交叉影响 |
| 文件中心 | 上传、下载、列表 | `files` 表不受 `customer_file_paths` 新表影响 |
| 系统管理 | 用户、角色、日志 | 签证域仅新增权限码，不修改角色管理逻辑 |

### 6.2 `notes` 表扩展兼容

- 新增 6 个 nullable 字段，历史数据不受影响。
- 客户备注 API 查询自动附加 `visa_case_id IS NULL` 条件，排除案件日志。
- 历史备注不回填 `log_type`，不被案件日志接口返回。

### 6.3 `customer_file_paths` 与 `files` 并存

- `customer_file_paths`：服务器路径台账（只记录路径元信息），新增表。
- `files`：上传附件（承载实际文件二进制），既有表。
- 两者在前端以不同 Tab/区块展示，不混淆。

### 6.4 新旧提醒并存

- **新签证提醒**（`/visa-reminders`、工作台摘要）：基于 `visa_cases.expire_date` + 案件状态/日志推导。
- **客户主档在留日**（`person_info.residence_expire_date`）：仍在建档与客户 **详情** 维护；**不再**提供与历史版本同构的 **独立聚合列表 API/路由**（产品冻结 **§1.5**）。列表/详情上对客户行的在留风险感知，走既有 **派生字段**（如 `alertLevel`、`visaDerivedRisk`，以代码为准）。
- **数据口径**：主档在留日与案件到期日 **独立计算、语义不强制相等**；一线扫视 **案件维度** 以签证提醒/工作台为主。

---

## 7. 验收矩阵

### 7.1 S1–S4 冻结决策验收

| # | 验收项 | 验收标准 | 状态 |
|---|--------|---------|------|
| S1 | 家族签建模 | `visa_cases` 含 `is_family_case` / `family_link_mode` / `internal_primary_customer_id` / 外部主申请人快照字段；`visa_case_family_members` 表有唯一主申请人约束与联合唯一索引 | ✅ |
| S2 | notes 扩表 | `notes` 含 `visa_case_id` / `log_type` / `submitted_items` / `missing_items` / `next_action` / `next_follow_up_at`；历史数据不受影响 | ✅ |
| S3 | 权限与路由 | 14 个签证子权限码已注册种子数据；签证提醒路由 `/visa-reminders` 已接入；工作台 `/workbench/visa` 已接入（P2-S1）；**无**独立在留列表路由（**§1.5**） | ✅ |
| S4 | 接口契约 | 19 个新增 API 端点均已实现；旧 `/customers/{id}/notes` **不受破坏**；`GET /customers/residence-expiry-reminders` **已按 §1.5 移除**（非「破坏」表述：专表端点与产品决策同步下线） | ✅ |

### 7.2 S5–S9 案件与家属验收

| # | 验收项 | 验收标准 | 状态 |
|---|--------|---------|------|
| S5 | 最小建案 | 从客户详情签证域 Tab 可创建最小签证案件；不替换现有新建客户主流程 | ✅ |
| S6 | 核心字段 | 案件类型、状态、家庭签模式、负责人、到期/跟进、材料状态、费用状态可编辑可回显 | ✅ |
| S7 | 内部主申请人 | `INTERNAL` 模式下 `internal_primary_customer_id` 正确指向系统内主申请人；唯一性约束生效 | ✅ |
| S8 | 外部主申请人 | `EXTERNAL` 模式下保存外部主申请人快照（名称/案件类型/到期日）；不创建外部客户主档 | ✅ |
| S9 | 多家属挂案 | 一个案件可挂多个家属；家属增删改稳定回显；主申请人唯一约束生效 | ✅ |

### 7.3 S10–S13 日志与路径验收

| # | 验收项 | 验收标准 | 状态 |
|---|--------|---------|------|
| S10 | 案件日志 | 日志可创建/列表/详情/编辑/删除；`log_type` 必填；支持已交/缺失材料、下一步动作、下次跟进时间 | ✅ |
| S11 | 备注与日志分栏 | 客户详情中客户备注与案件日志在不同区块展示；不做混合时间线；旧备注接口与用法不受影响 | ✅ |
| S12 | 资料路径台账 | 可按客户/案件维度创建路径；支持路径类型、显示名称、备注 | ✅ |
| S13 | 路径展示与复制 | 详情中资料路径分组展示；复制操作可用；文案与旧附件 Tab 区分 | ✅ |

### 7.4 S14–S15 提醒验收

| # | 验收项 | 验收标准 | 状态 |
|---|--------|---------|------|
| S14 | 四类提醒聚合 | 补件提醒 / 今日待跟进 / 7天内到期 / 2个月内到期 四个桶均可输出；去重优先级正确；已过期案件归入"7天内到期"桶 | ✅ |
| S15 | 提醒主路径 | `/visa-reminders` 可访问；`/workbench/visa` 可访问（权限见 §17）；**无**旧独立在留列表页/API（**§1.5**）；主档在留仍在客户详情展示 | ✅ |

### 7.5 S16–S18 详情页与回归验收

| # | 验收项 | 验收标准 | 状态 |
|---|--------|---------|------|
| S16 | 签证域四区块 | 客户详情签证域 Tab 内含案件摘要、家属成员、资料路径、案件日志四个区块；`material_status` 摘要展示 | ✅ |
| S17 | 创建/补录向导 | 向导支持主申请人模式选择、案件信息录入、动态家属录入；不改坏现有客户建档流程 | ✅ |
| S18 | 兼容性回归 | 客户列表/详情、备注 CRUD、主档在留字段展示、行政案件、税务合同、文件入口均无回归（**§1.5**：不再验收独立在留列表） | ✅ |

---

## 8. 技术实现清单

### 8.1 后端

| 分类 | 文件 |
|------|------|
| **Module** | `backend/src/modules/visa-case/visa-case.module.ts` |
| **Controller** | `visa-case.controller.ts` |
| **Services** | `visa-case.service.ts`, `visa-case-family-member.service.ts`, `visa-case-file-path.service.ts`, `visa-case-internal-primary.service.ts`, `visa-case-log.service.ts`, `visa-case-lookup.service.ts`, `visa-case-reminder.service.ts` |
| **Entities** | `visa-case.entity.ts`, `visa-case-family-member.entity.ts`, `customer-file-path.entity.ts` |
| **DTOs** | 16 个 DTO 文件（create / update / query 全覆盖） |
| **Mapper** | `visa-case.mapper.ts` |
| **Types** | `visa-case.types.ts` |
| **Tests** | `visa-case.service.spec.ts` + 3 个 DTO spec 文件 |
| **Migrations** | 签证域相关迁移清单见本文 **§2.4**（按时间戳顺序执行，具体以仓库 `backend/src/migrations` 为准） |
| **Enums** | 8 个签证域枚举（`VisaCaseStatus` 等） |
| **Permissions** | 14 个权限码 + 种子数据 |

### 8.2 前端

| 分类 | 文件 |
|------|------|
| **API** | `frontend/src/api/visa-case.ts` |
| **Types** | `frontend/src/types/visa-case.ts` |
| **Views** | `VisaReminderListView.vue`、`VisaWorkbenchView.vue`（`/workbench/visa`）、`VisaCaseRegistryView.vue`（P1-S4e）等 |
| **Components** | `CustomerVisaDomainTab.vue`, `CustomerVisaCasesTab.vue`, `CustomerVisaCaseDialog.vue`, `CustomerVisaCaseWizard.vue`, `CustomerFamilyMembersBlock.vue`, `CustomerFilePathsTab.vue`, `CustomerVisaCaseLogsTab.vue` |
| **Enums** | `frontend/src/constants/enums.ts` 新增 8 个枚举 |
| **Permissions** | `frontend/src/constants/permissions.ts` 新增 14 个权限码 |
| **Routes** | `frontend/src/router/routes.ts` 新增签证提醒路由 |
| **i18n** | `ja.ts` / `zh-CN.ts` 新增签证域翻译 |

---

## 9. 提醒桶计算规则

| 桶类型 | 条件 | 去重优先级 |
|--------|------|-----------|
| **补件提醒** | `case_status = SUPPLEMENT` 或最新案件日志含缺失材料/补件动作 | 最高（1） |
| **今日待跟进** | `next_follow_up_at` 为今天（来自 `visa_cases` 或最新日志） | 2 |
| **7天内到期** | `expire_date` 在今天至 7 天后之间，或已过期（已过期标记最高紧急度） | 3 |
| **2个月内到期** | `expire_date` 在 7 天至 2 个月后之间 | 最低（4） |

- 同一案件命中多个条件时，只归入优先级最高的桶。
- `external_primary_expire_date` 仅作外部主申请人快照，不参与新提醒桶计算。
- 旧提醒继续基于 `person_info.residence_expire_date`，与新提醒独立计算。

---

## 10. 家族签建模约束

| 约束 | 说明 |
|------|------|
| 一案一主申请人 | `visa_case_family_members` 中 `is_primary = true` 最多一条（部分唯一索引） |
| 家属不重复挂载 | 同一客户在同一案件中不得重复（联合唯一索引 `visa_case_id + customer_id`） |
| 家属解绑 ≠ 删除客户 | 移除家属关联不影响客户主档 |
| 有日志/路径的案件不物理删除 | 仅支持逻辑删除或状态变更 |
| 案件级与客户级家属并存 | `visa_case_family_members` 与 `person_info.primary_customer_id` 两套关系并存，P0 不做双向同步 |

---

## 11. P1 延续项（下一轮优先）

| 编号 | 内容 | 前置 |
|------|------|------|
| P1-S1 | **材料 checklist 数据模型**：在 P0 `material_status` 摘要基础上，补齐材料项、材料分组、案件/家属材料归属与状态流转规则 | P0 完成 |
| P1-S2 | **材料 checklist 可编辑 UI**：提供材料项新增、勾选、缺失标记、补件追踪等前端操作，并与案件日志联动 | P1-S1 |
| P1-S3 | **历史数据导入/补录工具**：支持历史签证案件、路径、关键时间点的人工校验导入；**口径冻結见 `docs/23_P1历史签证数据导入口径冻結.md`（P1-S3a）** | P0 完成 |
| P1-S4 | **签证域筛选与统计**：`GET /visa-cases`、`GET /visa-cases/stats`、客户列表派生风险；**S4a 冻結见 `docs/25_P1签证域筛选统计口径冻結.md`**；**S4h 验收场景与对账见同文档 §12** | P0 完成 |
| P1-S5 | **旧入口弱化策略**：**S5a 口径冻結见 `docs/26_P1旧入口弱化策略口径冻結_P1-S5a.md`**；S5b–S5e 在 S5a 定稿后实施；**S5f 验收与回归见本文 §14** | P1-S4 |

### P1 启动条件

- P0 全部 S 任务已通过验收
- `npm run verify` 通过（含测试）
- 数据库已执行所有 P0 migrations
- 生产环境运行稳定至少 1 个迭代周期

---

## 12. P2 后置探索

| 编号 | 内容 | 前置 |
|------|------|------|
| P2-S1 | **工作台/首页看板**：聚合提醒、案件状态、负责人待办与关键统计，形成签证域工作台；**P2-S1a 口径冻結见本文 §15**；**P2-S1h 验收场景与指标对账见本文 §17** | P1 基本稳定 |
| P2-S2 | **更细粒度数据权限**：按本人、团队、角色范围控制签证案件与提醒可见性 | P1 完成 |
| P2-S3 | **统一迁移与入口合并**：旧提醒侧差距评估见 **`docs/28`**；**行政案件与签证域策略（P2-S3c）摘要见本文 §19**，完整冻結见 **`docs/29_P2-S3c_行政案件与签证域策略口径冻結.md`** | P1/P2-S2 |

---

## 13. 部署注意事项

### 13.1 数据库迁移

部署前在目标环境执行 TypeORM 迁移，**应用所有尚未执行的 migration**（TypeORM 按时间戳顺序执行；签证域相关文件清单见本文 **§2.4**）。

```bash
npm run migration:run --prefix backend
```

> **说明**：早期本文曾仅列举 P0 首包 3 个文件；当前代码库已包含 P1/P2 增补迁移（团队表、数据范围性能索引、行政补录批次表、导入批次时间索引等），**以 §2.4 与仓库实际文件为准**，勿只执行旧三段式列表。

### 13.2 种子数据

如为全新环境，需重新运行种子脚本以注入签证域权限码与角色分配：

```bash
npm run seed --prefix backend
```

已有环境需手动确认签证域权限码已添加至对应角色。

### 13.3 前端构建

签证域组件已内联按需加载（`CustomerDetailView.vue` 中 Tab 级懒加载），不需要额外配置。

### 13.4 回滚预案

- 数据库：各 migration 均提供 `down()` 方法，可按执行逆序回滚（以 TypeORM 迁移历史为准）。
- 前端：签证域 Tab 为增量组件，回退代码即可移除。
- 权限：移除种子数据中签证域权限码，或手动清理 `permissions` 表相关记录。
- 旧功能不受影响：回滚不影响客户备注、旧提醒、行政案件、文件中心等既有能力。

---

## 14. P1-S5f 旧入口弱化：验收场景与回归清单

> **文档定位**：P1-S5 **S5f** 收口。与 `docs/26_P1旧入口弱化策略口径冻結_P1-S5a.md` §5–§8 对齐；用于发布前手测与权限组合回归。  
> **原则**：弱化为排序/分组/折叠/文案层（S5a §3），**不**删除路由与 API；深链书签须仍可达；**不得**用导航隐藏替代权限收紧（S5a §6）。

> **产品修订（2026-04-04，对齐 §1.5 / `docs/17` §1.10）**：旧在留独立列表路由 **`/customers/residence-reminders`** 与 **`GET /customers/residence-expiry-reminders`** **已移除**，**不属于** P1-S5「仅弱化导航」范畴，而是 **在留 90 天视图** 产品结论。下文 **B4** 及依赖旧在留深链的矩阵行 **已替换**为工作台主路径；`docs/26` 中「不得删除旧在留路由」的表述 **若与本节冲突，以 §1.5 及当前 `routes.ts` 为准**。

### 14.1 深链书签（须持续有效）

验收时直接用浏览器打开完整 URL（可含 query），应进入预期页面且核心接口与升级前一致，**不**因侧栏分组或默认折叠而 404/白屏。路由 `name` 以 `frontend/src/router/routes.ts` 为准。

**与侧栏 IA 的关系**：**§14.1 表格中 B1–B9 的 path 与深链书签持续有效**；若侧栏改为 **单一顶级客户中心 hub** 嵌套展示（**§5.4**），**仅导航层级变化**，**不**改变上述 URL、路由注册与守卫语义。

| # | URL（相对应用根） | `name` | 路由级权限（`meta.permissions`） | 验收标准 |
|---|------------------|--------|----------------------------------|----------|
| B1 | `/visa-reminders` | `VisaReminderList` | `visaReminder:list` | `GET /visa-reminders`；无权限时守卫拒绝（如 403），非白屏 |
| B2 | `/visa-cases` | `VisaCaseRegistry` | `visaCase:list` | P1-S4e 全局案件列表 |
| B3 | `/visa-case-import` | `VisaCaseImport` | `visaCase:import` | 历史导入工具（若已部署） |
| B4 | `/workbench/visa` | `VisaWorkbench` | `visaReminder:list` **或** `visaCase:list` | **（2026-04-04 替换原在留列表 B4）** 签证工作台；`GET /workbench/visa`；**§1.5** 主路径之一（原 `/customers/residence-reminders` **已废止**） |
| B5 | `/customers` | `CustomerList` | `customer:list` | 列表与分页正常 |
| B6 | `/customers/:id` | `CustomerDetail` | `customer:detail` | 各 Tab 深链有效 |
| B7 | `/customers/:id?tab=visa-domain&openVisaCaseId={uuid}` | `CustomerDetail` | `customer:detail` | 打开签证域并定位案件（或约定降级） |
| B8 | `/admin-cases` | `AdminCaseList` | `admin_case:list` | 行政案件列表 |
| B9 | `/admin-cases/:id` | `AdminCaseDetail` | `admin_case:detail` | 行政案件详情 |

**侧栏行为（与实现一致，供书签验收对照）**：顶级为 **「客户中心」hub**（**§5.4**）；其下为 **扁平** 子项列表：含 **客户列表**（`/customers`，依权限）、签证主路径（含工作台 **B4**、**§1.5**）、在留主档/行政案件等，**无**中间「签证业务 / 在留与行政」二级菜单。展开 hub 后 **一次列表内** 可点选 **B8** 等项。**§14.1** 所列 URL **不因** hub 嵌套而失效。

### 14.2 权限组合矩阵（手工验收）

下列组合用于角色配置回归；种子角色以 `backend/src/seeds/seed.ts` 为准。新签证提醒 **依赖** `visaReminder:list`；工作台 **`/workbench/visa`** 为 **`visaReminder:list` 或 `visaCase:list` 二选一**（与 §17.2 一致）。**无**独立在留列表入口（**§1.5**）。

| # | 场景 | `customer:list` | `customer:detail` | `visaReminder:list` | `visaCase:list`（及典型编辑类） | 预期 hub 内签证主路径项 | 预期 hub 内在留/行政项 | 预期 `/visa-reminders` 直达 | 预期 `/workbench/visa` 直达 | 客户详情签证域 Tab |
|---|------|-----------------|-------------------|---------------------|--------------------------------|----------------------|------------------------|-----------------------------|---------------------------|-------------------|
| P1 | 业务员工 / 管理者（宽口径） | ✅ | ✅ | ✅ | ✅ | 可见提醒、工作台、案件、导入（依子权限） | 可见行政案件等（依菜单配置） | ✅ | ✅ | 可见；编辑依 `visaCase:*` 等 |
| P2 | 有客户权限、**无** `visaReminder:list` | ✅ | ✅ | ❌ | 可选 | 仅展示具备权限的子项 | 依菜单配置 | ❌ → 403 | 若具备 `visaCase:list` 则 ✅，否则视菜单隐藏 | 依 `visaCase:detail` 等 |
| P3 | **无** `customer:list`、有 `visaCase:list` | ❌ | — | 可选 | ✅ | 可见案件等 | 在留/行政项依权限（无 `customer:list` 时主档在留项通常隐藏） | 依 `visaReminder:list` | 依 `visaCase:list` | 通常需 `customer:detail` 进入详情 |
| P4 | 财务人员（只读签证） | ✅ | ✅ | ✅ | list/detail 只读 | 可见只读入口 | 依菜单配置 | ✅ | ✅ | 只读为主 |
| P5 | 仅有行政案件、**无**客户列表 | ❌ | — | — | — | 依签证权限 | 依行政权限 | — | — | 需 `customer:detail` |

### 14.3 弱化专项回归（导航与文案）

| # | 回归项 | 通过标准 |
|---|--------|----------|
| N1 | 侧栏/顶栏（S5b） | 签证主路径项在 **客户中心 hub** 内可见；旧入口仍在 **同一扁平列表** 中（顺序靠后），**未**移除 |
| N2 | 客户详情 Tab/区块顺序（S5c） | 签证域与行政案件等旧 Tab **均可**访问；仅顺序/默认展开不同 |
| N3 | 在留卡 vs 案件到期文案（S5d） | 客户详情/列表提示区分「主档在留日」与「签证案件到期」（**§6.4**、**§1.5**）；**无**独立在留列表菜单项 |
| N4 | i18n / tooltip（S5e） | 中日副标题、空态、tooltip 与权限边界说明已落地，无贬损性用语 |

### 14.4 细粒度验收场景（S5f-1～S5f-8）

| # | 场景 | 验收步骤 | 期望结果 |
|---|------|----------|----------|
| S5f-1 | 工作台深链（原 B4 替换） | 使用 **§14.1 B4** `/workbench/visa` 登录后打开 | `GET /workbench/visa` 正常；具备 `visaReminder:list` 或 `visaCase:list`（**§1.5**） |
| S5f-2 | 旧书签新提醒 | 使用 B1 URL | 数据来自 `GET /visa-reminders`；无权限时 403，非白屏 |
| S5f-3 | 客户详情深链 | 使用 B7 | 打开对应 Tab 并处理 `openVisaCaseId`（或优雅降级） |
| S5f-4 | 无签证提醒权 | 去掉 `visaReminder:list`，保留 `customer:list`（及可选 `visaCase:list`） | 可无「签证提醒」菜单项；**无**独立在留列表；若具备 `visaCase:list` 仍可达工作台（**§1.5**） |
| S5f-5 | 侧栏折叠 | 冷启动登录 | 展开 **客户中心 hub** 后，列表内 **一点击** 可达 **B8**；工作台 **B4** 与同层扁平项并列（**§1.5**） |
| S5f-6 | 客户详情 Tab 顺序 | 打开 B6 | 行政案件 Tab 可访问；顺序/弱化样式符合 S5c |
| S5f-7 | 文案与 tooltip | 悬停侧栏相关项 | 中日说明主路径与旧版数据源差异 |
| S5f-8 | 行政案件深链 | B8/B9 | 功能与 P0 一致，不受签证菜单前置影响 |

### 14.5 冒烟回归清单（与 §6.1 兼容项对齐）

| # | 模块 | 检查点 |
|---|------|--------|
| R1 | 客户列表 | 默认查询与分页；若启用 P1-S4d 筛选，不传 `visaReminderBucket` 时与旧行为一致 |
| R2 | 客户详情 | 基本信息、备注、签证域、税务、附件、行政案件各 Tab 可切换无报错 |
| R3 | 客户备注 | `/customers/{id}/notes` CRUD，`visa_case_id` 仍为空 |
| R4 | 主档在留展示 | 客户详情个人信息区展示 `residence_expire_date` / `alertLevel`；**无**独立聚合列表页（**§1.5**） |
| R5 | 新签证提醒 | B1 页四类桶与 §9 规则一致（需权限） |
| R6 | 全局案件 | `/visa-cases` 筛选、分页、跳转客户详情 |
| R7 | 行政案件 | 列表与详情、客户详情内行政 Tab |
| R8 | 税务合同 | 列表与详情 |
| R9 | 文件中心 | 上传/下载/列表 |
| R10 | 权限 | 抽测 §14.2 中 P2、P4，确认无「菜单隐藏代权限」的越权或误拒 |

### 14.7 与 P0/P1 总体验收及交付门禁

- **P0 功能回归**：仍以本文 **§7** 与 **§6.1** 为准；S5f **不**替代 S18 级全量回归，仅增补 **弱化相关** 场景。
- **P1-S4**：客户列表派生风险、全局案件筛选与统计验收以 **`docs/25_P1签证域筛选统计口径冻結.md` §12（S4h）** 为准。
- **`npm run verify`**：交付 P1-S5f 须通过（与 S5a §8、计划 P1-S5f 一致）。

### 14.8 横切 UAT 最小抽样（G-uat-sample：多角色 · 深链 · dataScope 下列表与统计对账）

> **用途**：里程碑或发布前 **手工抽测** 的「最小集合」，**不替代** §7、§14.2–§14.6 全量矩阵与 **`docs/25` §12（S4h）** 逐项验收；与 **`docs/27_P2-S2g_签证域数据范围发布说明.md` §5（F1a/F1b）** 及 §6 所列后端自动化对账 **互补**。  
> **执行人**：QA / 产品 / 研发在预发或验收环境勾选记录即可。

#### 14.8.1 多角色（最少 3 组账号）

| 抽样 | 对齐 §14.2 | 关注点 |
|------|------------|--------|
| U1 | P1（业务员工 / 管理者宽口径） | **客户中心 hub** 内签证主路径全入口（含工作台 B4）；`/visa-reminders` 可达；客户详情签证域 Tab 编辑依能力码 |
| U2 | P2（有 `customer:*`、**无** `visaReminder:list`） | `/visa-reminders` 拒访（如 403）；`/workbench/visa` 在具备 `visaCase:list` 时仍可达（**§1.5**） |
| U3 | P4（财务人员只读签证） | `/visa-cases` 与统计只读；写入口隐藏或 403 |

**可选加抽**：P3（无 `customer:list`、有 `visaCase:list`）验证侧栏子项与 B5/B6 深链组合。

#### 14.8.2 深链（最少 5 条 URL）

在 **U1** 账号下冷启动登录后，新开标签直接粘贴访问（可含 `dataScope`，与 `useVisaDataScopeRoute` / **`docs/27` §1.2** 一致）：

| # | URL（相对应用根） | 对齐 |
|---|------------------|------|
| D1 | `/visa-reminders` | §14.1 B1 |
| D2 | `/visa-cases`（及团队常用的筛选 query，若有） | §14.1 B2 |
| D3 | `/workbench/visa` | §14.1 B4（**§1.5** 取代旧在留 URL） |
| D4 | `/customers/{id}?tab=visa-domain&openVisaCaseId={uuid}` | §14.1 B7 |
| D5 | `/workbench/visa` | §17.1、§17.2 |

**通过标准**：无 404 / 白屏；无权限时守卫行为与 §14.1、§17.2 一致；带 `dataScope` 的书签落地后列表与统计仍同 scope（与 §18.6、**`docs/27` §1** 一致）。

#### 14.8.3 dataScope 下列表与统计对账

**登记册（`GET /visa-cases` / `GET /visa-cases/stats`）**：在 **`/visa-cases`** 固定一组筛选条件，切换账号允许下的 **`dataScope=mine` / `team` / `all`**（或等价 query 字段名，以 `QueryGlobalVisaCaseListDto` / `QueryVisaCaseStatsDto` 为准），用开发者工具确认 **列表与统计请求的 query 同构**（与 **`docs/25` §12.6 F2**、**§12.9** 末段及前端 `buildVisaRegistryStatsQueryParams` 注释一致）。对账时注意 **`caseStatusCounts` 含完结/取消全集**、**`reminderBuckets` / `noBucket` 仅在开放子集** 上累计，二者 **不可**强行相加找平（**`docs/25` §12.3 S4**）。

**工作台**：在 **同一 `dataScope`**（及与 UI 一致的 `assignedTo`，若暴露）下，`GET /workbench/visa` 返回的 **`stats` 与同参数的 `GET /visa-cases/stats` 一致**（§17.3、§15.3）；**勿**与「登记册已叠加其它筛选后的侧栏数字」直接对比（**`docs/25` §12.9** 末段）。

**提醒与客户列表（建议加抽 1 条）**：同一 `dataScope` 下刷新 **`/visa-reminders`** 与客户列表的派生风险 / `visaReminderBucket` 筛选，行为与 **`docs/27` §5 F1b**、§6 所列 Jest 文件名一致。

#### 14.8.4 记录与门禁

- 每次抽样在表格中 **勾选** 或附简短记录（角色、`dataScope`、环境、日期；必要时 HAR / 截图）。
- **代码门禁**仍以 **`npm run verify` / `verify:full`** 为准（§14.7）；本节抽样 **不降低** 自动化测试要求。

---

## 15. P2-S1a 工作台/首页看板：口径冻結（P2-S1）

> **文档定位**：P2-S1 **S1a** 冻結。定义工作台看板 **KPI/区块**、各块 **数据来源**、**路由与首页策略**、以及与 **P1-S4e/S4f** 的边界，避免工作台与全局案件页重复实现两套不一致的聚合逻辑。  
> **依赖**：P1 已提供 `GET /visa-reminders`、`GET /visa-cases`、`GET /visa-cases/stats` 及客户列表派生风险（见 `docs/25`）；P2-S1b 及以后实现须遵循本节。

### 15.1 目标（冻結）

- 提供 **单屏可操作的签证域工作台**，聚合 **提醒摘要**、**关键 KPI**、**可跳转的待办/列表**，减少在多菜单间往返。
- **不**在 P2-S1 阶段替换或删除 P1-S4e（全局案件列表页）、P1-S4f（统计视图）、签证提醒全表页；工作台与上述页面 **并存**，以 **跳转** 与 **摘要** 为主。

### 15.2 看板区块与 KPI 清单（冻結）

以下区块为 P2-S1 **建议默认拆分**（实现可合并 UI，但 **指标语义** 须与本表一致）：

| 区块 | 展示内容（KPI / 列表摘要） | 数据口径 |
|------|---------------------------|----------|
| **提醒摘要区** | 四类提醒桶 **计数**（`SUPPLEMENT` / `TODAY_FOLLOW_UP` / `EXPIRING_7_DAYS` / `EXPIRING_2_MONTHS`）；可选每桶 Top N 案件或客户 | 与 **`GET /visa-reminders`** 及 `docs/21` §9 **去重优先级**一致；计数应对 **案件** 去重后与列表页可解释对齐（差异须在 P2-S1h 记录） |
| **统计/KPI 区** | `docs/25` §5 已冻結 KPI：按 `case_status` 计数、按提醒桶计数、7 天窗口到期件数、今日待跟进件数、补件相关件数、未指定负责人件数等 | **优先直接复用 `GET /visa-cases/stats`** 的响应；**禁止**在工作台内手写第二套互不一致的 SQL 而不文档化差异 |
| **列表快捷区** | 窄筛选下的案件短列表（如「今日待跟进」「补件」）或链接至 **`/visa-cases`** 带 query | **复用 `GET /visa-cases`** 的分页与筛选语义（与 `docs/25` §3 一致）；工作台仅允许 **预置筛选器** 或 **深链**，不重新定义字段含义 |
| **待办可操作区（可选）** | 从提醒或列表派生的「可点击」行：跳转客户详情签证 Tab、案件详情、或「写案件日志」入口 | 写操作仍走既有 **`visaCaseLog:*` / `visaCase:edit`** 权限；工作台 **不**新增绕过 Guard 的 API |

**明确不在 P2-S1a 冻結内**（与 P0/P1 一致）：财务金额汇总、材料 checklist 完成率、实时大屏秒级刷新、行级数据范围过滤（属 **P2-S2**，口径见本文 **§18**）。

### 15.3 各块数据来源（冻結）

| 数据需求 | 首选来源 | 备注 |
|----------|----------|------|
| 提醒桶列表与详情行 | `GET /visa-reminders` | 权限 `visaReminder:list` |
| 聚合 KPI、卡片数字 | `GET /visa-cases/stats` | 权限 `visaCase:list`（与 `docs/25` §6 一致） |
| 可筛选、可分页的案件表 | `GET /visa-cases` | 权限 `visaCase:list`；与 P1-S4e 同一契约 |
| 客户维度跳转 | 客户详情路由 + 既有客户 API | 不强制工作台调用客户列表派生风险 API，若展示客户级摘要须与 `docs/25` §4 一致 |

### 15.4 首页与工作台路由策略（冻結）

| 策略 | 冻結结论 |
|------|----------|
| **是否替换登录后默认首页** | **默认不替换**：保持系统现有默认落地页（如仪表盘/首页）不变，除非产品单独立项并修订计划文件。 |
| **工作台入口** | **新增**独立路由（例如 `/workbench/visa` 或项目约定路径）；侧栏上位于 **客户中心 hub** 内 **扁平列表**，与「签证提醒」「全局案件」等 **同级**（非多个并列顶级菜单）；需同时具备的最小权限集在 P2-S1c 实现时写明（建议至少 `visaReminder:list` 或 `visaCase:list` 之一可见，无权限则隐藏菜单）。 |
| **与全表页关系** | 工作台提供「查看全部」类跳转至 **`/visa-reminders`**、**`/visa-cases`**（及带 query 的筛选态），**不**要求工作台复制全表能力。 |

### 15.5 与 P1-S4e / P1-S4f 的边界（冻結）

| 维度 | P1-S4e / S4f（已有主路径） | P2-S1 工作台 |
|------|---------------------------|--------------|
| **职责** | **全量** 列表筛选、分页、统计图表/卡片 **主战场** | **摘要 + 跳转 + 轻量待办**；同一筛选语义通过 **同一 API** 复用 |
| **统计逻辑** | `GET /visa-cases/stats` 为 **权威** 聚合出口之一 | 工作台 KPI **须调用或薄封装**该接口，避免重复计算规则 |
| **列表逻辑** | `GET /visa-cases` 为 **权威** 列表出口 | 工作台短列表 = 带固定 query 的同一接口或前端截取 **第一页**；排序规则与 `docs/25` §3 一致 |
| **UI 重复** | 允许工作台与 S4e/S4f **视觉相似**（降低认知成本），但 **不得**出现同一 KPI 在两处 **长期不一致** 且无文档说明 |

### 15.6 P2-S1 下游任务衔接（提示）

| 子任务 | 依赖本节 |
|--------|----------|
| **P2-S1b** | 若多接口拼装成本过高，可新增只读聚合接口，但字段语义须与本节 §15.2–§15.3 对齐 |
| **P2-S1c** | 路由、菜单、`MainLayout`、权限与 i18n 骨架 |
| **P2-S1d–S1f** | 各区块对接 §15.3 数据来源 |
| **P2-S1h** | 验收场景、入口与指标说明见本文 **§17**；与 `docs/25` §12（S4h）、本文 §14（P1-S5f）交叉对账 |

---

## 16. 变更管理

- 任何签证域口径变更，**必须先修改计划文件**（签证客户中心计划优化），再动 schema / API / UI。
- **P2-S2 数据范围（本人 / 团队 / 全部）** 变更须先修订本文 **§18**，再改查询层与 Guard。
- 枚举值变更须同步更新 `backend/src/common/constants/enums.ts`、`frontend/src/constants/enums.ts`、`frontend/src/constants/enum-labels.ts`。
- 权限码变更须同步更新 `backend/src/common/constants/permission-codes.ts`、`frontend/src/constants/permissions.ts`、`backend/src/seeds/seed.ts`。

---

## 17. P2-S1h 签证工作台：验收场景与入口指标说明

> **文档定位**：P2-S1 **S1h** 收口。与 **§15（P2-S1a）** 冻結口径一致；用于发布后手测、权限组合回归及与 **P1-S4 统计/列表** 的数值对账。  
> **不替代**：P0 **§7**、P1-S4h（`docs/25` §12）、P1-S5f（本文 **§14**）的既有验收矩阵。

### 17.1 入口、深链与路由元信息

| 项 | 约定 |
|----|------|
| **URL（相对应用根）** | `/workbench/visa` |
| **路由 `name`** | `VisaWorkbench`（以 `frontend/src/router/routes.ts` 为准） |
| **侧栏位置** | **客户中心 hub** 内 **扁平 `children`**，与 `/visa-reminders`、`/visa-cases` 等同级；顺序上在 `/customers`（若可见）之后（`frontend/src/layouts/MainLayout.vue`、`main-layout-menu.config.ts`） |
| **登录后默认首页** | **不**替换；仍为系统默认落地页（与 §15.4 一致） |

**深链书签（须持续有效）**：登录后直接打开 `/workbench/visa`，在具备 **任一** 子权限时应进入工作台；双无权限时应被前端守卫拒绝（如跳转 403），**非**白屏。

### 17.2 权限语义（前后端对齐）

工作台路由与 `GET /workbench/visa` 均采用 **「命中任一权限即通过」**：

| 权限码 | 说明 |
|--------|------|
| `visaReminder:list` | 仅有此项时：可进入工作台；四分桶预览与计数随聚合返回；**「查看全部提醒」「按桶跳转 `/visa-reminders`」** 等链接可用；**「打开登记册」** 依赖 `visaCase:list`（无则隐藏） |
| `visaCase:list` | 仅有此项时：可进入工作台；KPI / 状态分布 / 登记册跳转可用；**聚合接口仍返回提醒预览与桶计数**（与 `GET /workbench/visa` 实现一致）；**跳转签证提醒全表页的链接隐藏**（前端以 `visaReminder:list` 控制） |

**双无**：无 `visaReminder:list` 且无 `visaCase:list` 的用户 —— 菜单项不应展示该项（分组可见性仍受子项权限并集控制）；直链须拒绝。

**编辑类权限**：`visaCaseLog:create` 等 **不**作为进入工作台的门槛；页面内「写案件日志」等按钮按既有权限显隐（与 §15.2「待办可操作区」一致）。

### 17.3 后端契约摘要（验收对账用）

| 项 | 约定 |
|----|------|
| **方法路径** | `GET /workbench/visa` |
| **Query** | `assignedTo`（可选 UUID，负责人收窄）；`previewLimit` 整数 **0–20**，默认 **5**；**0** 表示仅返回 `stats`、不加载桶预览（与 `QueryVisaWorkbenchDto` 一致） |
| **响应体** | `stats`：与 **`GET /visa-cases/stats`** 同源（见 §15.3）；`reminderPreviews`：四类键 `supplement` / `todayFollowUp` / `expiring7Days` / `expiring2Months`，每键为行数组，行结构对齐 `GET /visa-reminders` 列表项 |
| **桶规则** | 与本文 **§9** 去重优先级一致；工作台待办合并列表若跨桶展示，同一案件仅保留最高优先级桶（与列表页去重语义一致） |

**与 P1-S4 对账**：工作台 KPI 数字应与 **案件登记册**（或独立统计视图）同一参数下 **`GET /visa-cases/stats`** 一致；若存在差异，须在发布说明中记录原因（§15.5 禁止长期不一致且无说明）。

### 17.4 页面区块与验收关注点

| 区块 | 验收关注点 |
|------|------------|
| **刷新 / 加载** | 首屏骨架；手动刷新成功提示；首次加载失败时错误态 + 重试；已有数据时刷新失败保留旧数据并提示（横幅或文案） |
| **统计 / KPI 区** | 展示 `stats` 中与产品文案一致的卡片（如未指定负责人件数、7 日窗、今日待跟进、补件相关、`noBucket` 等）；案件状态分布与 `caseStatusCounts` 一致且仅展示计数大于 0 的项 |
| **待办合并区** | 多桶合并排序：补件 > 今日跟进 > 7 日窗 > 2 个月窗；同案去重；空态文案；行级跳转：客户详情、案件上下文、`visaCaseLog:create` 时显示写日志 |
| **提醒摘要区** | 四分桶卡片：每桶计数与预览列表；「查看该桶提醒」跳转 `/visa-reminders` 等带约定 query（若实现）；「查看全部」与登记册链接在具备对应权限时可用 |
| **国际化** | 中日文案、tooltip 与 §15.2 口径说明一致（如 KPI 与 `/visa-cases/stats` 对齐的提示） |

### 17.5 验收场景清单（S1h-1～S1h-12）

| # | 场景 | 前置 / 操作 | 期望结果 |
|---|------|-------------|----------|
| S1h-1 | **无相关权限** | 角色无 `visaReminder:list` 且无 `visaCase:list` | 侧栏无工作台项；访问 `/workbench/visa` → 403 或守卫拒绝，非白屏 |
| S1h-2 | **仅有提醒权限** | 仅有 `visaReminder:list` | 可进入工作台；桶预览与计数有数据或空态合理；**提醒全表/按桶深链按钮可见**；无 `visaCase:list` 时登记册入口隐藏；`GET /workbench/visa` 200 |
| S1h-3 | **仅有案件列表权限** | 仅有 `visaCase:list` | 可进入工作台；KPI/状态区与跳转 `/visa-cases` 可用；**桶预览与计数仍可展示**（与聚合接口一致）；**「查看全部提醒」「按桶跳转提醒页」不可见** |
| S1h-4 | **宽口径用户** | 两权限皆有 | 全区块正常；跳转 `/visa-reminders`、`/visa-cases` 正常 |
| S1h-5 | **无案件数据** | 空库或筛选后无件 | 各区块空态友好，无未处理异常 |
| S1h-6 | **仅有提醒、无待办合并行** | 有桶计数但预览条数为 0 或合并截断 | 计数与列表一致；合并区空态或「仅统计」行为符合 `previewLimit` |
| S1h-7 | **仅有 KPI、无提醒命中** | stats 非零、提醒全空 | KPI 与 `GET /visa-cases/stats` 对账；提醒区空态 |
| S1h-8 | **负责人收窄** | Query `assignedTo`（若 UI 暴露）或与后端一致传参 | `stats` 与预览同时收窄，与 §15.3 数据来源一致 |
| S1h-9 | **previewLimit=0** | 直接调用 API 或开发者工具 | 仅 `stats`、`reminderPreviews` 各桶为空数组（或约定等价结构） |
| S1h-10 | **刷新失败保留旧数据** | 模拟第二次请求失败 | 展示 Stale 提示并可重试，不静默清空 |
| S1h-11 | **写日志按钮** | 无 `visaCaseLog:create` | 不展示或禁用写日志入口，不越权调用 |
| S1h-12 | **与 §14 交叉** | P1-S5 弱化后的侧栏 | 工作台仍在 **客户中心 hub** 扁平列表内可达；深链 B1/B2 与 §14.1 仍独立有效 |

### 17.6 冒烟回归（与签证域主路径）

| # | 检查点 |
|---|--------|
| H1 | `/visa-reminders` 全表与 §9 桶规则未因工作台新增而回归 |
| H2 | `/visa-cases` 列表与 `docs/25` 筛选语义未回归 |
| H3 | `GET /visa-cases/stats` 单独调用结果与工作台 KPI 一致 |
| H4 | `npm run verify`（或发布约定门禁）通过 |

### 17.7 P2-S1 父项收口说明

- **P2-S1 父项验收**仍以计划文件中 **P2-S1a–S1g** 各子任务为准；本节 **仅承担 S1h**（验收与文档）。  
- 若后续迭代调整工作台 API 字段或权限，须先修订 **§15** 与本节，再改实现。

---

## 18. P2-S2a 签证域数据范围：本人 / 团队 / 全部（口径冻結）

> **文档定位**：P2-S2 **S2a** 冻結。定义签证域 **数据范围** 三档语义、**团队** 的数据来源（三选一写死）、与现有 **`visaCase:*` / `visaCaseLog:*` / `customerFilePath:*` / `visaReminder:*`** 的 **能力（Capability）** 与 **范围（Data scope）** 组合关系，供 **P2-S2b–S2d** 实现与验收引用。  
> **不替代**：`docs/07_权限矩阵与角色设计.md` 全局 RBAC 说明；本节仅约束 **签证域行级范围** 与权限的 **叠加规则**。

### 18.1 术语：能力 vs 数据范围

| 维度 | 含义 | 判定位置 |
|------|------|----------|
| **能力（Capability）** | 能否调用某接口、能否执行某类写操作 | 现有 `@Permissions` / 路由 meta / 按钮权限；权限码含义 **不变** |
| **数据范围（Data scope）** | 在 **已具备能力** 的前提下，允许 **读出或写入** 的 **案件（及派生聚合）行集合** | P2-S2c 在 Visa 相关 Service / QueryBuilder **统一注入**；**禁止**仅靠前端隐藏 |

**硬规则**：无 `visaCase:list`（或各接口已声明的替代门槛）则 **403**，与 `scope` 无关；**不得**用 `scope=all` 或管理员身份 **绕过** 缺失的 `visaCase:edit` 等写能力。

### 18.2 三档范围枚举（冻結）

| 枚举值（建议 Query） | 中文 | 语义（以 `visa_cases` 为锚点） |
|----------------------|------|--------------------------------|
| `mine` | 本人 | 仅 **`assigned_to = 当前用户 id`** 的案件（见 §18.3） |
| `team` | 团队 | **`assigned_to` 落在 §18.4 定义的「团队成员用户 id 集合」内** 的案件（含本人） |
| `all` | 全部 | **不按负责人过滤**，与现网 P0/P1 **宽口径列表/聚合** 一致（仍受软删、业务状态等既有条件约束） |

**默认**：未传范围参数时 **`all`**，保证与已上线行为向后兼容。

**建议参数名**：实现阶段在 Query DTO 中冻結统一字段名（如 `dataScope` 或 `scope`），枚举 **仅** 使用上表三值（小写字符串）。

### 18.3 「本人」（`mine`）冻結

- **字段**：`visa_cases.assigned_to`（TypeORM 关联属性 `assignee`，API 侧常体现为 `assignedTo` UUID）。  
- **包含**：`assigned_to` **等于**当前登录用户主键的案件。  
- **不包含**：`assigned_to IS NULL`（未指派案件 **不**算在「本人」范围内，避免与公共池混淆）。若日后业务要求「本人含未指派」，须 **先修订本节** 再改查询。

### 18.4 「团队」（`team`）：数据来源三选一（冻結为 **可配置成员集合**）

计划中的「部门 / 角色组 / 可配置成员集合」在本项目内 **写死采用可配置成员集合**，理由如下：

| 候选 | 结论 |
|------|------|
| **部门** | **不采用**。当前 `users` 表 **无**部门/组织字段；若未来引入组织维度，须 **新开计划修订** 并扩展本节，**不**在本节隐含默认部门列。 |
| **角色组（RBAC 角色）** | **不采用**。`roles` / `user_roles` 表示 **功能授权**；若直接用作数据范围，会出现「改角色编码即改变可见数据」、与 **能力** 语义耦合，难审计。 |
| **可配置成员集合** | **采用**。由管理者维护 **团队实体** 与 **用户—团队多对多**；登录用户所属团队并集得到 `teamUserIds`（UUID 集合）。 |

**`team` 范围判定（冻結）**：

- 案件满足：`assigned_to IS NOT NULL` **且** `assigned_to ∈ teamUserIds`；  
- **或** `assigned_to = 当前用户 id`（本人始终在「团队」视角内，即使配置遗漏亦不应把本人排挤出团队视图——实现时可将 `currentUserId` 显式并入 `teamUserIds`）。

**P2-S2b 落库前过渡策略（冻結）**：在 **团队表及用户关联未迁移完成** 前，服务端对 `team` 须与 **`all` 行为一致**（返回相同行集），**不得**返回空集导致已登录用户误判；若选择 **拒绝** `team`（`400`），须在 P2-S2d 的 API 说明中 **显式写明**，且前端 **不得**默认传 `team`。**推荐**过渡：按句一，与 `all` 等价。

### 18.5 「全部」（`all`）冻結

在已通过对应 **能力** 校验的前提下，**不**按 `assigned_to` 追加过滤；与当前 `GET /visa-cases`、`GET /visa-cases/stats`、`GET /visa-reminders`、`GET /workbench/visa` 的默认语义一致。

### 18.6 与权限码的组合关系（冻結）

**能力门槛（摘录，以实际 Controller 声明为准）**：

| 能力 | 典型权限码 | 数据范围是否适用 |
|------|------------|------------------|
| 跨客户案件列表 / 统计 | `visaCase:list` | **适用** `mine` / `team` / `all` |
| 签证提醒列表 / 桶聚合 | `visaReminder:list` | **适用**（与提醒所基于的案件行一致收窄） |
| 工作台只读聚合 | `visaReminder:list` **或** `visaCase:list`（命中其一） | **适用**；`stats` 与 `GET /visa-cases/stats` 须 **同一** scope；`reminderPreviews` 与 `GET /visa-reminders` 须 **同一** scope |
| 客户名下案件列表 | `visaCase:list`（客户上下文） | **适用**（与客户详情内列表一致） |
| 案件详情 / 日志 / 路径只读 | `visaCase:detail` 等 | **适用**：若案件不在 scope 内 → **404 或 403**（P2-S2d 统一 HTTP 语义，须与「不泄漏存在性」策略一致） |
| 案件更新 / 日志写 / 路径写 | `visaCase:edit`、`visaCaseLog:*`、`customerFilePath:*` | **能力 + 范围双校验**：无能力 403；有能力但目标案件不在 scope 内 **403** |

**`customerFilePath:list` 等**：以 **关联的 `visa_case_id` 或客户上下文** 为准；若路径挂在案件下，**随案件** scope；仅客户级路径时 **是否**收窄由 P2-S2c 与产品确认，**默认建议**：与 `GET /customers/:id` 已可见客户一致即可（不额外按 assignee 过滤路径行），除非修订本节。

**客户列表派生签证风险（P1-S4d）**：若将来对列表增加与签证相关的 EXISTS 过滤，**须复用与 `GET /visa-cases` 相同的 scope 助手**，避免同一用户在不同页面看到矛盾风险标签。

### 18.7 管理员与默认策略（衔接 P2-S2g）

- **默认产品行为**：业务侧用户 **允许** 使用 `all`（与历史宽口径一致）；**是否**对特定角色 **禁止** `all`、强制上限为 `team`，由角色配置落地，**不在本节写死禁止 `all`**。  
- **系统管理者**：数据范围上限与存量兼容说明见 **§18.9（P2-S2g）**；实现时 **不得**仅凭「管理者」或 `dataScope=all` 就绕过 **写能力** 缺失（见 §18.1 硬规则）。

### 18.8 P2-S2 下游任务衔接

| 子任务 | 依赖本节 |
|--------|----------|
| **P2-S2b** | 团队实体与用户—团队多对多存储；未完成前遵守 §18.4 过渡策略 |
| **P2-S2c** | 在签证列表、提醒、统计、工作台聚合、（可选）客户 EXISTS 中 **统一注入** scope 条件 |
| **P2-S2d** | 扩展 Query DTO、`scope` 与 Guard/越权用例；404/403 语义与 **双校验**（§18.6） |
| **P2-S2e** | 前端范围控件与 URL query 同步；非法组合隐藏或禁用 |
| **P2-S2g** | 发布说明：**§18.9**（默认 scope、管理员豁免、对老用户/角色影响） |

### 18.9 P2-S2g 发布说明：默认 `dataScope` 与管理员豁免

> **文档定位**：P2-S2 **S2g** 收口。供上线沟通、角色配置与验收对照；实现语义以 `VisaCaseDataScopeService`、`VisaCaseDataScopePermissionService` 及前端 `visa-data-scope` 工具为准。

#### 18.9.1 发布范围（读者需要知道什么）

- Query 参数 **`dataScope`**：`mine` / `team` / `all`（与 §18.2 一致），作用于跨客户案件列表、统计、签证提醒聚合、工作台聚合、客户列表派生 EXISTS 等已接入统一 scope 助手的读接口及对应写路径上的 **行级范围** 校验。  
- 权限码 **`visaCase:dataScopeMine`**、**`visaCase:dataScopeTeam`**、**`visaCase:dataScopeAll`**：定义用户在签证域 **可选的最宽数据范围上限**（与 **能力** 权限正交，见 §18.1）。

#### 18.9.2 默认 scope（产品与 API）

| 场景 | 约定 |
|------|------|
| **请求未带 `dataScope`** | 服务端按 **`all`** 解析（不按负责人过滤），与 §18.2、§18.5 及已上线宽口径列表默认行为一致。 |
| **路由 / 书签未带 `dataScope`** | 前端将「请求范围」视为缺省后再按 **§18.9.4** 与用户上限 **clamp**，在授权允许时等价于 **`all`**。 |
| **显式传 `mine` / `team` / `all`** | 须在用户 **最大允许范围** 之内；否则后端 **403**（`VisaCaseDataScopePermissionService`），前端也会将控件限制在可选档位内。 |

#### 18.9.3 对存量用户与角色的影响（Rollout）

| 情况 | 行为 |
|------|------|
| **角色未授予任一 `visaCase:dataScope*`** | **最大允许范围视为 `all`**（与 P0/P1 一致），**无需**为兼容而批量改库即可发布；仅当希望收窄可见数据时，才在角色上 **显式** 分配 `dataScopeMine` / `dataScopeTeam` 并 **不** 分配 `dataScopeAll`。 |
| **种子数据** | `ADMIN` 持有 **`*`**；`STAFF`、`FINANCE` 默认含 **`visaCase:dataScopeAll`**，上线后默认仍可看全量案件行（在已具备 `visaCase:list` 等能力的前提下）。 |
| **`team` 与团队表** | 用户未加入任何团队时，实现上 **`team` 与 `all` 返回相同行集**（见 §18.4 推荐过渡策略），避免空团队误判为「无数据」。 |

#### 18.9.4 「管理员豁免」的准确含义

**豁免的是数据范围上限，不是业务写能力。**

| 身份 / 权限 | 数据范围上限 | 写操作 |
|-------------|--------------|--------|
| 持有 **`*`** 或 **`visaCase:*`** | 与持有 **`visaCase:dataScopeAll`** 相同，最宽为 **`all`** | **不豁免**：仍须具备 `visaCase:edit`、`visaCaseLog:*`、`customerFilePath:*` 等对应 **能力** 权限；**禁止**仅凭管理者或 `dataScope=all` 绕过缺失的写权限（§18.1 硬规则）。 |
| 仅持有 `visaCase:list` 等能力、**无**任一 `dataScope*` | 上限 **`all`** | 同上，写能力单独校验 |

**说明**：系统 **不** 单独依赖「用户是否管理者」标志做 scope 放宽；凡权限集合满足 **`*`**、**`visaCase:*`** 或 **`visaCase:dataScopeAll`**，即视为在签证域允许请求 **`all`** 档位。

#### 18.9.5 运营侧配置建议（可选）

- 若要对一线岗位收窄为仅本人或团队：在角色管理中 **移除 `visaCase:dataScopeAll`**，仅保留 `visaCase:dataScopeMine` 和/或 `visaCase:dataScopeTeam`，并确保用户已维护 **团队—成员** 关系后再依赖 `team` 语义。  
- 变更角色后已打开的浏览器页可能仍带旧 URL；刷新后分段控件与请求参数会与 **新上限** 对齐。

#### 18.9.6 单文件发布包（与 `docs/27` 的关系）

- **`docs/27_P2-S2g_签证域数据范围发布说明.md`** 与 **§18.9.1–18.9.5** 口径一致，便于运维单文件分发；其中补充 **发布验收勾选项** 与 **实现路径索引**。若正文与本文冲突，**以本节（§18.9）为准**。

---

## 19. P2-S3c 行政案件（`admin_cases`）与签证域：策略摘要

> **文档定位**：计划 **P2-S3c** 在本文内的 **边界对齐摘要**，便于只读 `docs/21` 的读者把握 **`admin_cases` vs `visa_cases`** 的长期关系。**权威冻結、允许/禁止清单与下游衔接** 以 **`docs/29_P2-S3c_行政案件与签证域策略口径冻結.md`** 为准；字段级启发式对照与不可自动迁移项见 **`docs/28_P2-S3a_旧提醒与行政案件向签证域差距评估.md`** §2。

### 19.1 与本文既有冻结的一致性

| 本文条款 | P2-S3c 结论 |
|----------|-------------|
| §1.1 职责边界表 | `admin_cases` 与 `visa_cases` **并列域**，各自主对象、各套权限前缀与菜单策略 |
| §1.3 不做事项 | **不**采用单域强统一、**不**批量废弃行政表或 `/admin-cases/*` |
| §3.2 保留接口 | 导航或工作台合并 **不得** 删除、410 或静默下线行政 REST 契约 |
| §14 / `docs/26` | 入口弱化仅限排序、分组、折叠、文案；**不得**用「仅签证权限用户看不到行政」替代 `admin_case:*` 权限设计 |

### 19.2 冻結采用：默认 **独立数据域 + 仅入口/导航合并**

- **存储与 API**：两表、两套模块边界；**无**默认双写、**无**同步中间表作为基线架构。
- **子实体**：面谈 / 任务 / 行政文档 **留在** 行政模块；家属、案件日志、`customer_file_paths`、签证提醒桶 **留在** 签证模块。
- **产品**：侧栏可在 **同一客户中心 hub** 内将行政与签证入口 **同一扁平列表并列**（并列链接，承接 P2-S3e）；客户详情、工作台等入口策略不变；深链书签须持续有效（与 **§14.1** 一致）。

### 19.3 冻結允许：「部分映射」= **人工或工具驱动的签证侧补录**，非系统合并域

- 允许在 **人工确认** 或 **P2-S3d** 工具（dry-run、幂等、行级失败）下，将 `docs/28` §2.2 所列字段（如 `customer_id`、`expire_date`、`owner_user_id`→`assigned_to`）作为 **初始值** 写入 **新建或已有** `visa_cases`。
- **禁止**：无映射表的 **自动** 状态对齐、**默认** 迁入 `admin_case_interviews` / `admin_case_tasks` / `admin_case_documents`、**静默** 隐藏行政数据或入口。

### 19.4 明确不采纳（除非先修订本文 §1 / §1.3 / §3.2 与计划文件）

单表强统一、1:1 自动全量迁移、行政↔签证 **双向实时同步**。

### 19.5 P2-S3 下游衔接（摘录）

| 子任务 | 依赖 |
|--------|------|
| **P2-S3d** | 行政→签证补录工具须遵守 **§19.3** 与 `docs/29` §2.2 |
| **P2-S3e** | 入口合并时 **并列** 暴露行政与签证跳转；权限仍分 `admin_case:*` 与 `visaCase:*` |
| **P2-S3g** | 抽样、权限、深链、回滚：**`docs/30_P2-S3g_迁移与入口合并验收.md`** |
