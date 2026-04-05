# Phase B：操作审计与导出范围（权限对齐与最小闭环）

> **文档定位**：单所阶段 **Phase B** 收口说明。明确 `audit_logs`、`login_logs`、`export_logs` 的职责边界、与 RBAC 的对应关系，以及 **已实现** 的最小导出闭环。  
> **效力**：与 `docs/07_权限矩阵与角色设计.md` §5.3、`docs/21_签证客户中心P0验收与Rollout说明.md` 权限章节 **互引**；实现以 `backend/src/modules/log/` 与 `backend/src/modules/visa-case/visa-case.controller.ts` 为准。

---

## 1. 三张日志表的职责

| 表 | 用途 | 典型写入方式 |
| --- | --- | --- |
| `audit_logs` | **业务操作审计**：谁在何时对哪个业务对象做了什么动作（成功/失败），可带请求体快照 | 带 `@AuditAction()` 的写接口拦截器；部分批量动作在 Service 内 `LogService.createAuditLog` |
| `login_logs` | **认证轨迹**：登录/登出、成功/失败与失败原因 | `AuthService` |
| `export_logs` | **离境类动作留痕**：附件流式下载/预览、**审计 CSV 导出** 等 | `FileService` 等流式响应路径；`LogService.createExportLog`（CSV 导出成功时） |

**不在本节扩展的范围（后续迭代再立项）**：字段级脱敏策略、导出水印、客户/案件业务数据的通用批量导出、跨模块统一导出中心 UI。

---

## 2. 权限矩阵对齐（`log:list`）

| 能力 | 权限码 | 角色建议（见 `docs/07`） |
| --- | --- | --- |
| 操作日志列表 `GET /logs/audit` | `log:list` | 管理员默认；业务/财务 **默认关闭**（与 `docs/07` §5.1「日志中心」一致） |
| 登录日志列表 `GET /logs/login` | `log:list` | 同上 |
| 导出日志列表 `GET /logs/export` | `log:list` | 同上 |
| **操作审计 CSV** `GET /logs/audit/export.csv` | `log:list` | **与列表同源权限**；导出前须在服务端写入 `export_logs`（`export_type = AUDIT_LOG_CSV`） |

**结论**：不在本期新增「仅导出」子权限，避免权限爆炸；若事务所要求业务角色也可导出审计，应通过 **角色绑定 `log:list`** 控制，而非绕过后端校验。

---

## 3. `export_type`（`ExportType`）约定

| 枚举值 | 含义 | 写入场景 |
| --- | --- | --- |
| `FILE_ATTACHMENT_STREAM` | 附件以 `attachment` 下载 | 既有文件模块流式下载 |
| `FILE_PREVIEW_STREAM` | 附件以内联预览 | 既有文件模块预览 |
| `AUDIT_LOG_CSV` | 操作审计 CSV | `GET /logs/audit/export.csv` 成功返回文件流后 |

`export_logs.export_params` 保存筛选摘要（如 `limit`、时间范围、`actionType` 等），便于与下载文件、前端操作者交叉对账。

---

## 4. 审计覆盖范围（签证域补充，最小闭环）

以下写操作在 **本期** 补充 `@AuditAction`（或保持既有 Service 级审计），与 **`customer:*` / `visaCase:*` 权限**一致——**有权限调用接口即会产生审计记录**（失败亦记 `FAILURE` 由拦截器处理）。

| 区域 | `targetType`（`AuditTargetType`） | 说明 |
| --- | --- | --- |
| 资料路径台账 CRUD | `CUSTOMER_FILE_PATH` | `POST .../file-paths`、`PUT/DELETE /file-paths/:id` |
| 材料模板管理 | `MATERIAL_TEMPLATE` | `material-templates` 的创建/更新/停用 |
| 案件材料 checklist 变更 | `VISA_CASE`（`UPDATE`） | 初始化/手增/更新/删除材料项、`sync-status`；目标 ID 为 **案件 ID** |
| 签证案件 CRUD / 日志 / 家属 | 既有 | `VISA_CASE` / `VISA_CASE_LOG` |
| 历史 CSV 取込确定 | 既有 | Service 内 `VISA_CASE_IMPORT` + `IMPORT` |
| 行政→签证补录确定 | 既有 | `VISA_CASE_ADMIN_SUPPLEMENT` |

**只读接口**（列表、详情、预览 dry-run）默认 **不写** `audit_logs`，与全系统惯例一致。

---

## 5. 操作审计 CSV 导出行为

- **筛选维度**：与 `GET /logs/audit` 一致（操作者关键字、`actionType`、`targetType`、时间范围、`result` 等），另支持 `limit`（默认 2000，最大 5000）。
- **排序**：与列表相同白名单字段（默认 `occurredAt DESC`）。
- **格式**：UTF-8，带 BOM；列为英文字段名；`beforeValue`/`afterValue` 为 JSON 字符串列。
- **留痕**：每次成功生成文件流前写入 `export_logs`（失败不写或后续迭代再定义）。

---

## 6. 变更与扩展门禁

- 新增 **面向业务数据的批量导出**（客户/案件/财务）须：单独文档定义字段范围、权限码、是否脱敏、是否写 `export_logs`，并修订 `docs/07`。
- 新增 **`export_type` 枚举值** 须同步：`backend/src/common/constants/enums.ts`、本文档 §3、种子/前端若展示导出日志则补标签。

---

**结论**：✅ Phase B **最小闭环** = 签证域高风险写操作审计补全 + 操作审计 CSV 导出与 `export_logs` 对齐 `log:list`；更广义的「业务导出中心」仍属后续迭代。
