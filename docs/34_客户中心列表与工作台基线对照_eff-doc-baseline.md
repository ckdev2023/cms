# 客户中心：列表 / 工作台基线对照（eff-doc-baseline）

> **用途**：对照 `docs/21_签证客户中心P0验收与Rollout说明.md`（下称 **doc 21**）、`docs/签证客户中心_PRD_开发版.md`（下称 **PRD**）、SaaS 路线图 Phase A 中与列表/工作台相关的叙述，与**当前仓库实现**做一次「已满足 / 缺口 / 不做」快照，避免重复造轮与**未修订冻结文档即改口径**。  
> **权威顺序**：业务冻结与验收以 **doc 21** 及交叉引用（`docs/17`、`docs/25`、`docs/27` 等）为准；PRD 未同步处以下文「PRD 漂移」为准，**不以 PRD 覆盖 doc 21**。

---

## 1. 已满足（与 doc 21 / P1–P2 收口一致）

| 能力 | 文档锚点 | 实现要点（代码侧） |
|------|-----------|-------------------|
| 签证工作台路由与权限 | doc 21 §5.1、§17.2 | `/workbench/visa`，`visaReminder:list` **或** `visaCase:list` 二选一；`routes.ts` meta 与后端 `GET /workbench/visa` 对齐 |
| 工作台 KPI / 统计同源 | doc 21 §15.3、§17.3 | `VisaWorkbenchView` + `useVisaWorkbench` 拉聚合；KPI 语义与 `GET /visa-cases/stats` 对齐（刷新失败保留旧数据等交互见 §17.4） |
| 四分提醒桶 + 待办合并 | doc 21 §9、§17.3–17.4 | 桶预览、`mergedActionTodoRows`、跳转客户详情 / 案件上下文 / 写日志（权限内） |
| 签证数据范围 `dataScope` | doc 21 §18、`docs/27` | 工作台与客户列表等处的 `VisaDataScopeSegmented`、`useVisaDataScopeRoute` 与后端 scope 助手联动 |
| 签证提醒全表页 | doc 21 §3.1、§5.1 | `/visa-reminders`、`VisaReminderListView` |
| 全局案件登记册 + 统计 | doc 21 §3.1、`docs/25` | `/visa-cases`、`GET /visa-cases`、`GET /visa-cases/stats` |
| 客户列表「主展示案件」摘要列 | doc 21 §1.6、`docs/17` §1.11 | `listPrimaryVisaCase` 类型/状态/到期/下次跟进/负责人；后端选取与排序规则有单测（如 `customer-list-primary-visa-case`） |
| 列表派生签证风险 / 提醒桶筛选 | doc 21 §6.1、`docs/25` | `visaDerivedRisk` 列、`visaReminderBucket` 筛选，与 `dataScope` 同传 |
| 客户详情签证域 Tab 与深链 | doc 21 §5.2、§14.1 B7 | `tab=visa-domain`、`openVisaCaseId`、`visaDomainBlock`（含 materials 等子区块）；无权限时回落并清理 query |
| 新建主路径未被合并向导替代 | doc 21 §1.3 | 仍为「新建客户 → 详情 → 签证 Tab 建案」；未见替代默认顺序的列表级「客户 + 首案」向导 |
| 客户备注 vs 案件日志分栏 | doc 21 §1.4、§7 S11 | 详情中备注与案件日志分开展示；不写混合时间线 |

---

## 2. 缺口 / 待对齐（效率里程碑可认领，但勿踩冻结红线）

| 主题 | 说明 | 与路线图 / doc 关系 |
|------|------|---------------------|
| 列表行内「快捷动作」 | 当前客户列表行操作主要为 **详情 / 编辑 / 删除**（`CustomerListView.vue`）；**无**行内「写案件日志」「打开资料路径」等 Phase A 叙述中的直达动作 | SaaS 路线图 Phase A「从列表直达动作」；实现前确认权限与主展示案件 ID 传递 |
| 详情默认 Tab | `CustomerDetailView` 默认 `activeTab` 仍为 **`basic`**；仅当 URL `tab=` 合法时切换，**无**「按未结案案件自动落在签证域」的智能默认 | Phase A「默认落在与当前业务最相关的 Tab」；若做，建议先产品一句规则再实现，避免与 §1.3 主路径表述冲突 |
| 单路径写日志（列表入口） | 工作台侧已有写日志跳转；**客户列表**未提供「一键打开当前主展示案件日志表单」 | doc 21 §1.4 要求跟进写案件日志；列表层属体验增强，不替代详情/工作台 |
| **doc 21 §1.5 与实现对账（高优先级）** | **文档**：独立在留列表路由/API 已废止，主路径为工作台 + 签证提醒；**客户列表在留到期区间筛选**表内为「本期不做（须先修订 doc 17 与本节）」。**代码**：仍注册 **`/customers/residence-reminders`**（复用 `CustomerListView`），侧栏仍有「在留」类入口；**总览 `/customers` 上亦展示 `residenceExpireWithinDays` 筛选并传参至 `GET /customers`** | 要么**修订 doc 21 / doc 17** 明确「轻量在留视图 + 列表筛选项已采纳」，要么**收敛路由/筛选项**与冻结一致；**禁止**在未改文档的情况下假装不存在该能力或反向删除已选主路径组件 |
| 可选列：最近一条案件日志摘要 | doc 21 §1.6、路线图 Phase A / B | 列表未展示「最近日志摘要」列；属增强项，依赖 API 与性能评估 |
| PRD 与冻结枚举不一致 | PRD 三、四 中状态/日志类型等与现网枚举 **不一致** | 实现与验收以 **doc 21 §2.3** 与代码常量为准；改 PRD 或标注「历史草案」即可，勿按 PRD 回改已冻结枚举 |

---

## 3. 明确不做（冻结项 — 未修订 doc 21 / doc 17 / 计划前禁止当作需求实现）

| 项 | 锚点 |
|----|------|
| 客户备注与案件日志 **混合总时间线** | doc 21 §1.3、§1.4 |
| **替代**「新建客户 → 详情 → 签证 Tab 建案」**默认顺序**的列表/弹窗级「客户 + 首案」合并向导 | doc 21 §1.3 |
| 恢复 **`GET /customers/residence-expiry-reminders`** 式专用聚合 API（旧在留列表同构） | doc 21 §1.5、§3.2 |
| `material_status` **自动推导**（P0） | doc 21 §1.3 |
| 仅靠前端隐藏菜单实现 **行级数据权限 / 越权访问控制** | doc 21 §1.3、§18.1 |
| **替换**登录默认首页为工作台（除非单独立项修订 §15.4） | doc 21 §15.4、§17.1 |
| `admin_cases` 与 `visa_cases` **单域强统一**、批量废弃行政 API | doc 21 §1.3、§19 |
| SaaS 多租户 / 计费 / 委托人门户等 | 路线图 §4 Phase C；勿与效率里程碑混排 |

---

## 4. PRD（开发版）只读提示

- PRD 将 `visa_cases` 放在「P1」、页面结构中的材料 checklist 与冻结 **doc 22 / doc 21 P1** 进度可能不一致时，以 **里程碑文档 + 迁移文件** 为准。  
- PRD「提醒页」四类与 doc 21 §9 **一致**；字段命名（如 `owner_user_id`）在 API 中多为 `assignedTo` 等 DTO 形态，以 OpenAPI/类型为准。

---

## 5. 变更本清单之后

若实现上收敛或扩展列表/工作台行为，请同步：**doc 21** 对应小节、交叉引用 **`docs/17` / `docs/25` / `docs/27`**，以及计划文件（见 doc 21 §16）；**勿仅更新本文件**作为唯一依据。
