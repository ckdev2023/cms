# Stitch「创建新申请档案」与现行「新建客户」字段对比

## 0. 培训摘要：固定表述（勿混用）

以下句子可直接用于培训 / PRD 摘抄，避免与实现对不上号。

### 0.1 两个「是否家族」不要写反

| 字段 | 主语 | 正确含义 |
| --- | --- | --- |
| **`person_info.isFamilyMember`**（客户主档 · 个人扩展） | **当前这条客户档案** | 是否在主数据上登记为 **另一主客户的家族成员（挂靠）** |
| **`visa_cases.is_family_case`**（`isFamilyCase`） | **本案签证案件** | 是否按 **家族签** 场景办理，并维护内部/外部主申与随申家属 |

→ 禁止写成「关掉客户的家族成员开关 = 本案不带家属」；后者应使用案件上的 **`isFamilyCase`** 与家属成员表。

### 0.2 两个「类型」不要映射错

| 字段 | 维度 | 正确含义 |
| --- | --- | --- |
| **`customers.service_type`**（`serviceType`） | 客户主档 | 事务所 **服务范围**（行政 / 税理 / 二者），`ServiceType` 枚举 |
| **`visa_cases.case_type`**（`caseType`） | 签证案件 | **签证申请类目**（推荐取值见系统字典 **`visa_case_application_type`**，详见 **`docs/17` §10.4**）；库字段仍为 varchar，允许历史自由文本与「其他」自定义 |

→ Stitch 设计稿里的「业务类型」若指签证申请，应对齐 **案件 `caseType`**，**不能**用客户表单的 **`serviceType`** 代替。

### 0.3 两个「负责人」（并存）

| 字段 | 含义 |
| --- | --- |
| **`customers.owner_user_id`** | **客户主档**负责人 |
| **`visa_cases.assigned_to`** | **案件**负责人 |

→ 侧栏摘要或报表若只写「负责人」，须注明是指 **客户** 还是 **签证案件**。

### 0.4 客户「负责人」下拉的权限说明（实现侧）

- 与签证案件负责人下拉相同，活跃用户候选来自 **`GET /system/users`**，后端要求 **`system:user_manage`**；无该权限时下拉可能为空（与既有签证弹窗行为一致）。
- 是否允许 **写入** `ownerUserId` 仍由 **`customer:create` / `customer:edit`** 等业务权限控制；**不**存在单独的 `customer:update` 权限码（与 `customer:edit` 为同一能力）。

---

## 1. 设计来源

| 项 | 内容 |
|----|------|
| 用户链接 | [Stitch 项目节点](https://stitch.withgoogle.com/projects/10718222335218430760?node-id=d0d9d6ceece045e0bd9bf46ec1d2331a) |
| Stitch 屏幕标题 | **完善家属添加逻辑 - 签证客户中心** |
| 页面主标题（HTML） | **创建新申请档案** |
| 说明 | 同项目中 **「新建客户/案件」** 屏与上述屏在「主申请人基本信息」等区块字段基本一致；链接对应屏额外强调 **随附家属成员（多行）**、**关联主申请人（内部 / 外部主申）** 与 **档案预览** 侧栏。 |

对比基准：**现行实现** = 前端 `CustomerFormDialog.vue` + `customerFormDialogModel.ts`，后端 `CreateCustomerDto` / `PersonInfoDto` / `CompanyInfoDto` 及 `customers` / `person_info` 实体。

### 1.1 术语与语义固定写法（培训 / PRD 引用）

> 以下表述建议在 **PRD、操作手册、对内培训** 中原样引用或缩述，避免将不同主语、不同数据层级或不同业务维度的字段写进同一句话。

#### `person_info.is_family_member` 与 `visa_cases.is_family_case`

| 字段（代码 / 表） | 数据层级 | 主语（问题在描述谁） | 培训口径（固定说法） |
|-------------------|----------|----------------------|----------------------|
| `is_family_member`（`person_info`） | 客户主档 · 个人扩展 | **当前这条客户** 在 CRM 中是否登记为 **另一主客户** 名下的家族成员 | 「**我在系统里是不是别人家的家属**」— 与 `primary_customer_id`、`family_relation` 等联动 |
| `is_family_case`（`visa_cases`） | 签证案件 | **本案（主申视角）** 是否 **带有陪同家属** 一并办理 | 「**本案主申要不要带家属**」— 与案件家属成员、`family_link_mode` 等联动 |

**禁止表述**：勿写「打开客户上的家族成员开关 = 主申带有陪同家属」— 前者主语是 **当前客户与主客户的关系**，后者主语是 **签证案件是否家族同案**。

#### `customers.service_type` 与 `visa_cases.case_type`

| 字段（代码 / 表） | 数据层级 | 语义 | 培训口径（固定说法） |
|-------------------|----------|------|----------------------|
| `service_type`（`customers`） | 客户主档 | 事务所对该客户提供的 **服务范围 / 业务条线**（行政、税理等，见冻结枚举） | 「**客户维度** 的事务所服务类型」 |
| `case_type`（`visa_cases`） | 签证案件 | **本案** 的签证申请或办理 **类目**（设计稿常为 PR、归化、家族滞在、技人国等） | 「**案件维度** 的签证申请类型 / 案件类型」 |

**禁止表述**：勿将 Stitch「业务类型（签证申请类目）」或培训中的「办什么签证」**映射**到客户表的 `service_type`；与 Stitch 对齐时应写到 **签证案件** 的 `case_type`（及向导案件步），`service_type` 仅描述 **客户与事务所的服务关系**。

**交叉引用**：对照总表见 §4；签证向导侧展开见 §8.2、§8.3。

---

## 2. Stitch 设计中的字段结构（自 HTML 抽取）

### 2.1 主申请人基本信息

| 设计标签 | 说明 / 占位 |
|----------|-------------|
| 全名 (Name) | 请输入完整姓名 |
| 护照号码 (Passport No.) | E12345678 |
| 联系电话 (Phone) | 090-XXXX-XXXX |
| 电子邮件 (Email) | example@mail.com |
| 居住地址 (Address) | 当前在日本或其他地区的详细地址 |

### 2.2 案件信息详情

| 设计标签 | 说明 |
|----------|------|
| 业务类型 (Business Type) | 下拉：永住申请 (PR)、归化申请、家族滞在、技术・人文知识・国际业务 等（偏 **签证申请类型**） |
| 是否有陪同家属？ | 是 / 否（分段单选式 UI） |

### 2.3 随附家属成员（链接屏重点）

表格列：**姓名**、**关系**、**护照号码**、**联系方式**；支持 **添加行 / 删除行**；多条家属并列录入。

### 2.4 关联主申请人（针对家族滞在业务）

| 区块 | 内容 |
|------|------|
| 选项 1 | 关联 **内部系统客户**（搜索并链接已有主申档案） |
| 选项 2 | **手动输入外部主申**：外部主申请人姓名、持有签证类型、签证到期日、与申请人关系（设计稿常为自由文本；**现行实现**为与主档 `family_relation` 一致的 **`FamilyRelation` 枚举下拉**，见 §8.4） |

### 2.5 其他（设计）

- **档案预览** 侧栏：展示申请人、业务类型、家属人数等摘要。
- **智能验证提示** 文案区（非数据字段）。

---

## 3. 现行「新建客户」表单与接口字段

### 3.1 主档（`CreateCustomerDto` 顶层）

| 字段 | 前端展示 | 必填 / 默认 |
|------|----------|-------------|
| customerName | 客户名 | 必填 |
| phone | 电话 | 选填 |
| email | 邮箱 | 选填（格式校验） |
| wechatId | 微信 | 选填 |
| lineId | LINE | 选填 |
| address | 地址 | 选填 |
| serviceType | 事务所**服务范围**（行政 / 税理等枚举）；**非**签证案件的申请类目，口径见 **§9.2** | 必填 |
| customerType | 个人 / 法人（新建时由扩展栏填写情况推导） | 提交时确定 |
| ownerUserId | 客户主档负责人（**非**签证案件 `assigned_to`） | 选填；与 §9.3 区分培训表述 |

**数据库 `customers` 表**：无护照号字段。

### 3.2 法人扩展（`companyInfo`）

| 字段 | 说明 |
|------|------|
| corporationNumber | 法人编号 |
| fiscalMonth | 决算月（1–12） |
| representativeName | 代表者姓名 |

### 3.3 个人扩展（`personInfo`）

| 字段 | 说明 |
|------|------|
| nationality | 国籍 |
| residenceStatus | 在留资格 |
| residenceExpireDate | 在留期限日 |
| isFamilyMember | 是否家族成员（开关）；**主语**见 **§9.1**（勿与案件「是否家族签 / 陪同家属」混用） |
| familyRelation | 家族关系（配偶 / 子女 / 父母 / 其他） |
| primaryCustomerId | 主客户 ID（远程搜索 **内部客户**） |
| remindDaysBefore | 提前提醒天数（1–365） |

**数据库 `person_info` 表**：无护照号；主申关联仅 `primary_customer_id`（内部客户 UUID），无「外部主申姓名 / 外部签证类型 / 外部到期日」等独立列（若签证域有扩展，见签证案件模块另行对照）。

---

## 4. 对照总表

| Stitch 概念 | 现行系统 | 对齐情况 |
|-------------|----------|----------|
| 全名 | customerName | **对应**（文案不同：客户名 vs 全名） |
| 护照号码 | — | **缺失（实现侧）**；**产品冻结**：主数据落 `person_info`（见 `docs/17` §1.12），迁移与界面待迭代 |
| 联系电话 | phone | **对应** |
| 电子邮件 | email | **对应** |
| 居住地址 | address | **对应** |
| 微信 / LINE | wechatId / lineId | **系统有，设计稿无** |
| 业务类型（签证申请类目） | serviceType（事务所服务类型） | **语义不一致**：枚举维度不同（**固定写法**见 §1.1 `service_type` vs `case_type`） |
| 是否有陪同家属 | isFamilyMember（个人扩展） | **弱对应**：设计为「主申是否带家属」；系统为「当前客户是否为家族成员」（**固定写法**见 §1.1 `is_family_member` vs `is_family_case`） |
| 随附家属多行（姓名/关系/护照/联系方式） | 单客户单表单；家属需 **单独建客户** 或走签证域 | **缺失**（无单行内多家属草稿模型） |
| 关联内部主申 | primaryCustomerId + 远程搜索 | **对应**（无 Stitch 中「选项 1」文案包装，能力类似） |
| 外部主申（姓名、签证类型、到期日、关系文本） | 创建客户表单 **无**；**签证建案向导** 在 `family_link_mode = EXTERNAL` 时映射 `visa_cases` 外部快照字段 | **部分对齐**：关系字段现为 **`FamilyRelation` 枚举**，非 Stitch 自由文本（见 §8） |
| 国籍 / 在留资格 | nationality / residenceStatus | **系统有，该 Stitch 主申块未列** |
| 在留期限 + 提前提醒 | residenceExpireDate / remindDaysBefore | **系统有，该 Stitch 主申块未列**（设计在外部主申块有「签证到期日」） |
| 法人信息 | companyInfo 三字段 | **系统有，该 Stitch 屏未展示** |
| 负责人（客户主档） | ownerUserId | **对应**（可选下拉；与案件负责人不同见 §9.3） |
| 档案预览 / 智能提示 | — | **无**（纯 UI/流程） |

---

## 5. 结论与差异摘要

1. **身份标识**：设计强调 **护照号**（主申与家属列均有）；现行库表 **尚无列**。**产品 + 落点已冻结**：`docs/17` §1.12（`person_info`、不设全局唯一等）；实现须迁移 + DTO/API/UI。
2. **「创建」粒度**：Stitch 偏向 **一次创建「申请档案」+ 主申 + 多名家属 + 案件类型**；现行是 **单客户 CRUD**，家属通过「家族成员 + 主客户」表达，**不支持** 在同一弹窗内维护多名家属行。
3. **主申关联**：内部链接与现行 `primaryCustomerId` 接近；**外部主申** 在 **签证案件** `visa_cases`（EXTERNAL 快照列）与建案向导中 **已实现**，**新建客户弹窗** 仍无该字段组（见 §8）。
4. **业务类型**：设计下拉为 **签证申请类型**；现行 `serviceType` 为 **事务所服务范围**（如行政・税理），**不能直接等同**。
5. **系统多出的能力**：微信 / LINE、法人三字段、国籍与在留资格、在留期限与提醒天数、编辑模式下个人/法人分栏禁用规则等——设计该屏未体现或与「签证客户中心」另一套信息架构并行。

---

## 6. 建议的后续动作（需产品确认）

- 明确「创建新档案」在实现上是 **客户主档**、**签证案件** 还是 **合并向导**；护照主数据落点已冻结为 **`person_info`**（`docs/17` §1.12）；多家属仍须区分 **单独建客户** vs **仅案件挂载** 的产品表述。
- 若保留单客户模型：在 PRD/设计中标明家属 **必须单独建档** 或通过 **签证案件家属维度** 录入，与 Stitch 多行 UI 择一收敛。
- 外部主申请人：对照 `docs/21_签证客户中心P0验收与Rollout说明.md` 及 `visa-case` 相关口径，确认是否已有或规划存储位置，再补前端入口与对比文档增量章节。

---

## 7. 产品决策记录 —「创建新档案」主路径（2026-04-05）

### 7.1 决策议题

在 Stitch「创建新申请档案」单屏意图与现行实现之间，确认 **官方主路径** 是否保持两步拆分，是否允许列表/弹窗级「客户 + 首案」合并向导，或仅通过引导优化衔接。

### 7.2 备选方案定义

| 代号 | 含义 |
|------|------|
| **(a)** | **保持**「新建客户 → 客户详情 → 签证 Tab 建案（`CustomerVisaCaseWizard`）」**两步主路径**，案件类型与家属等语义继续在签证域向导中完成。 |
| **(b)** | 在客户列表或新建弹窗层提供 **「客户 + 首案」合并向导**（或等效单屏），使主路径在交互上 **合并为一步或强绑定连续流**。 |
| **(c)** | **不切流程**：主路径仍为 (a)，仅通过 **文案、成功后续步提示、不改变顺序的快捷入口/深链** 等加强引导。 |

### 7.3 会议结论（书面）

1. **主路径选定 (a)**：在 P0 收口与当前冻结期内，**「创建新档案」对应的主路径** 以 **客户主档建档 + 详情页签证 Tab 建案** 为准；与 `docs/21_签证客户中心P0验收与Rollout说明.md` §1.1、§1.3 中「不替换旧客户建档流程」的边界 **一致**。
2. **增量选定 (c)**：允许在 **不取代 (a) 顺序** 的前提下做引导类增强（例如新建成功后的下一步提示、跳转客户详情签证 Tab、列表操作列快捷打开建案入口等）；此类增强 **不构成**「旧客户建档流程替换」。
3. **(b) 的定位**：列表/弹窗级 **客户 + 首案合并向导** 若作为 **新的默认主路径** 推广，属于 **流程级变更**，须 **单独产品排期**、技术方案（事务边界、权限、回滚）与培训同步；**落地前须修订 `docs/21` §1.3**（及相关冻结段落），不可仅依赖实现侧默认切换。
4. **与 Stitch 单屏的差距**：单屏中的案件类型、多行家属、侧栏预览等 **仍按既有模块边界** 拆解实现（字段与向导对照见本文 §4–§6 与改进计划交叉分析）；**不以 (b) 未排期而回退 (a) 的冻结结论**。

### 7.4 是否修订 `docs/21` §1.3

**是（增补澄清，不改变原冻结含义）。** 已在 `docs/21` §1.3 增加 **「创建新档案」主路径** 锚点条款，明确 (a)/(c) 与 (b) 的边界，避免将引导增强误读为「建档流程替换」。

---

## 8. 与 `CustomerVisaCaseWizard` / `visa_cases` 对照（Stitch 增量）

本节将 Stitch「创建新申请档案」中与 **案件 / 家属 / 外部主申** 相关的语义，对照 **客户详情 → 签证域 → 签证案件 Tab → 建案向导** 的现行实现；**不**重复 §3「仅新建客户弹窗」字段表。

### 8.1 入口与代码落点

| 项 | 说明 |
|----|------|
| **UI 入口** | 客户详情页 **签证域 Tab**（`CustomerVisaDomainTab.vue`）→ **签证案件** 子 Tab（`CustomerVisaCasesTab.vue`）：列表展示该客户名下案件；**新建**打开 `CustomerVisaCaseWizard.vue`（步骤：`CustomerVisaCaseWizardStepCase.vue` → `CustomerVisaCaseWizardStepMembers.vue`）；**编辑**已有案件使用 `CustomerVisaCaseDialog.vue`。 |
| **后端** | 表 `visa_cases`（实体 `VisaCase`）、`visa_case_family_members`（`VisaCaseFamilyMember`）；创建与更新 DTO 见 `backend/src/modules/visa-case/dto/`。 |

### 8.2 Stitch 概念与现行差异总表

| Stitch 设计概念 | 现行落点 | 与 Stitch 的差异 |
|-----------------|----------|------------------|
| **业务类型（签证申请类目）** | `visa_cases.case_type`（`VisaCase.caseType`）；向导案件步为 **字典下拉**（`visa_case_application_type`）+ **allow-create** 兜底，与 `docs/17` §10.4 对齐 | Stitch 为 **固定下拉**；现行以 **系统字典 + 自定义文本** 收口，可与历史自由文本并存 |
| **是否有陪同家属** | `visa_cases.is_family_case`（`isFamilyCase`） | 语义上接近 Stitch「主申是否带陪同家属」；**勿**与客户 `person_info` 的 `isFamilyMember`（**当前客户是否为其他主客户的家族成员**）混淆 |
| **关联内部主申请人** | `family_link_mode = INTERNAL` + `internal_primary_customer_id` | 与 Stitch「本公司 / 内部主申」一致：搜索并绑定已有客户 |
| **外部主申：姓名 / 签证类型 / 到期日 / 关系** | `family_link_mode = EXTERNAL` 时 `external_primary_name`、`external_primary_case_type`、`external_primary_expire_date`、`external_primary_relation_to_applicant` | Stitch「与申请人关系」为 **自由文本**；现行 `external_primary_relation_to_applicant` 为 **`FamilyRelation` 枚举**（`backend/src/common/constants/enums.ts`），不是任意 string |
| **随附家属表格（姓名、关系、护照号、联系方式）** | `visa_case_family_members`：`customer_id`、`member_role`、`display_name_snapshot`、`is_primary` 等 | 每行 **绑定已存在的客户**（`customerId`）+ **显示名快照**；**无**护照号、电话列——护照主数据口径见 **`docs/17` §1.12**（列尚未落地）。家属 **不能**在同一向导内「零客户草稿」批量造主档，须先建档或选已有客户 |
| **案件负责人** | `visa_cases.assigned_to` | **案件级**负责人；与客户主档 `owner_user_id` **并存且语义不同**；Stitch 侧栏若写「负责人」须注明指 **案件** 还是 **客户主档** |
| **档案预览侧栏** | 无 | Stitch 摘要 UI **未实现** |

### 8.3 与本文其他章节的关系

- **主路径**：与 §7、`docs/21` §1.1 / §1.3 一致——**先客户主档，再本向导建案**。
- **`serviceType` vs `caseType`**：仍适用 §4 / §5——事务所 **服务类型** 与签证 **案件类型** 不同维度；**培训 / PRD 固定说法** 见 **§1.1**。
- **`isFamilyMember` vs `isFamilyCase`**：**培训 / PRD 固定说法** 见 **§1.1**；§8.2 表格为技术落点摘要。
- **护照号**：主数据冻结见 `docs/17` §1.12；向导家属行不替代主档护照存储。

### 8.4 外部主申「与申请人关系」：枚举口径 vs Stitch 自由文本（决策与迁移评估）

**当前产品决策（默认）**：保持列 `external_primary_relation_to_applicant` 为 **`FamilyRelation` 枚举**（与 `person_info.family_relation`、`CreateVisaCaseDto` / `create-visa-case.dto` 注释口径一致）。前端在 **`CustomerVisaCaseWizardStepCase.vue`**、**`CustomerVisaCaseDialog.vue`** 使用 **下拉 + 说明文案**：明确与 Stitch「自由文本关系」的差异，并引导细则写入案件 **备注**。

**若产品坚持改为任意字符串**，需评估并串改以下链路（非单点改 UI）：

| 层级 | 影响 |
|------|------|
| **数据库** | PostgreSQL 列类型由枚举改为 `varchar`（或 `text`），或新增 `text` 列并弃用旧枚举列；须 **数据迁移** 将既有枚举值原样或映射为文本。 |
| **后端** | `VisaCase` 实体字段类型、`CreateVisaCaseDto` / 更新 DTO 的 `class-validator`（由 `@IsEnum(FamilyRelation)` 改为长度约束的 `@IsString` 等）、`visa-case.service` 读写、`visa-case.mapper` / 响应类型。 |
| **历史导入** | `visa-case-import-preview` / `visa-case-import-commit` 对 CSV「关系」列的解析与校验（当前按 `FamilyRelation` 校验）、相关 **Jest spec**。 |
| **前端** | `frontend/src/types/visa-case.ts`、`buildVisaCasePayload`、`CustomerVisaCaseDialog` / 向导表单由 `el-select` 改为 `el-input`（或混合「常用枚举 + 其他」），以及 **Vitest**。 |
| **冻结与培训** | 更新 **`docs/17`** 中与 `external_primary_relation_to_applicant` 相关的枚举说明；培训材料与 §2.4、§8.2 表格同步修订。 |

**结论**：在未修订冻结表与完成全链路迁移前，**不建议**仅因设计稿自由文本而单独放开该字段；**UI 枚举 + 说明** 为成本最低、与主档一致的方案。

---

## 9. 培训 / PRD 固定写法 — 易混语义（必读）

以下表述请在内部培训、PRD 与操作说明中 **固定使用**，避免与 Stitch 文案或口语简称混为一谈。

### 9.1 `person_info.is_family_member` **≠** 案件 `visa_cases.is_family_case`

| 写法 | 正确定义 | 常见误读 |
|------|----------|----------|
| **客户主档 · 家族成员开关**（`person_info.is_family_member`） | 描述 **当前这条客户档案** 是否在主数据上登记为「**另一主客户的家族成员**」（并配合 `primary_customer_id` / `family_relation`） | 误当成「**主申请人本次申请是否带有陪同家属**」 |
| **签证案件 · 家族签 / 陪同家属**（`visa_cases.is_family_case`） | 描述 **该签证案件** 是否按家族签办理、是否维护随附家属成员等（见建案向导与 `docs/21`） | 误当成客户主档上的「是否家族成员」开关 |

**固定话术示例**：「主档里的『家族成员』是说 **这个人是不是挂在别的主客户下面**；Stitch 里『有没有陪同家属』要在 **签证案件** 里看，字段是 **`is_family_case`**。」

### 9.2 `customers.service_type` **≠** `visa_cases.case_type`

| 写法 | 正确定义 | 常见误读 |
|------|----------|----------|
| **客户 · 服务类型**（`customers.service_type`） | 事务所对该客户的服务范围（行政 / 税理 / 両方等），**不是**签证申请品种 | 与 Stitch「业务类型（永住 / 归化 / 家族滞在…）」划等号 |
| **签证案件 · 案件类型 / 申请类目**（`visa_cases.case_type`） | 该签证案件的申请类型或类目（现行多为文本；与设计稿下拉选项的收口见 §8.2） | 误称为「客户服务类型」 |

**固定话术示例**：「**服务类型** 是客户主档上事务所接什么业务；**案件类型** 是签证 Tab 里 **具体办哪类签**。」

### 9.3 与「负责人」并存时的区分

- **客户主档负责人**：`customers.owner_user_id`（列表/详情可与 `ownerName` 同显）。
- **签证案件负责人**：`visa_cases.assigned_to`（与主档负责人 **并存、语义不同**）。

培训材料中若只写「负责人」，须注明 **客户主档** 还是 **签证案件**。

### 9.4 外部主申「与本案申请人关系」≠ Stitch 自由文本

| 写法 | 正确定义 |
|------|----------|
| **Stitch 设计** | 与申请人关系可为 **自由文本**（如口语「父子」「配偶」） |
| **现行系统** | **`FamilyRelation` 枚举下拉**，与客户主档 **「家属关系」** 同一套选项；更细的口语说明请写在案件 **备注** |

**固定话术示例**：「外部主申和本案申请人的关系在系统里是 **下拉选主档家属关系那一套**，不是随便打字；要写得更细可以放在 **案件备注**。」

---

*文档生成说明：设计字段来自 Stitch MCP 拉取的屏幕 HTML（`d0d9d6ceece045e0bd9bf46ec1d2331a`）；代码基准为仓库当前 `CustomerFormDialog` / `CreateCustomerDto`，以及签证域 `CustomerVisaCasesTab`、`CustomerVisaCaseWizard` 与 `visa_cases` 相关实体。*
