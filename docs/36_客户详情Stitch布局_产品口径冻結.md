# 客户详情 Stitch 布局 — 产品口径冻結（P1）

> 对应实施计划：客户详情 Stitch 排版改造（顶区 hero、2:1 栅格、日志 Rail、底栏等）。  
> **约束**：在不改后端、复用 `GET /customers/:id` 与 `listPrimaryVisaCase` 的前提下，下列口径为界面实现的唯一依据；与 [`docs/21_签证客户中心P0验收与Rollout说明.md`](21_签证客户中心P0验收与Rollout说明.md) 及 [`docs/17_业务口径冻结确认表.md`](17_业务口径冻结确认表.md) 冲突时，以本文件 **Stitch 专有条目** 为准，其余仍以 17/21 为准。

## 1. 负责人（案件担当）

| 项 | 口径 |
|----|------|
| 数据来源 | 主展示案件摘要 `listPrimaryVisaCase.assignedToUserId` / `assignedToDisplayName`（与列表同源）。 |
| 是否接「真实动作」 | **展示为只读**；变更负责人沿用既有 **打开案件 → 编辑案件**（`CustomerVisaCaseDialog` / 向导）流程，**不**新增独立 API 或 hero 内联编辑。 |
| 无 `assignedToDisplayName`（空串 / null） | **占位**：保留「案件担当」标签，取值使用 i18n `detailViews.customer.contextStrip.unassigned`（中文「未指定」/ 日文「未設定」）。**不**隐藏整行，避免 hero 栅格跳动。 |
| 头像 | 当前摘要 **无** 担当者头像字段：**不展示** Stitch 稿中的负责人头像组件；仅文字担当名 + 上述空态。若未来后端提供头像 URL，再单列变更。 |

## 2. 通知 / 铃铛

| 项 | 口径 |
|----|------|
| 数据来源 | 客户详情页 **无** 独立的「未读通知」或推送订阅字段可与 Stitch 铃铛 1:1 对应。 |
| 是否接真实动作 | **不接**；不调用不存在的通知 API，不造假红点数字。 |
| UI | **隐藏** 铃铛入口（及相关「设置」图标若仅表示通知偏好）。与 [`docs/28_P2-S3a_旧提醒与行政案件向签证域差距评估.md`](28_P2-S3a_旧提醒与行政案件向签证域差距评估.md) 中差距项一致：待产品定义统一提醒中心后再设计入口。 |

## 3. ETA / 期限类文案

| 项 | 口径 |
|----|------|
| 稿中「ETA」映射 | **不**引入名为 ETA 的新后端字段。与现有顶区一致，使用两行只读日期：**下次跟进** `nextFollowUpAt`、**在留期限** `expireDate`（案件级，见 `CustomerListPrimaryVisaCaseSummary`）。 |
| 无日期 | 沿用 `useLocaleFormatter().formatDate` 空值行为：展示 **`-`**（ASCII 连字符，与现有实现一致）。**不**用「待定」「TBD」等模糊文案，以免与业务枚举混淆。 |
| 是否接真实动作 | 仅展示；改期仍通过 **打开案件编辑** 或列表/工作台等既有入口。 |

## 4. 「催促补件」

| 项 | 口径 |
|----|------|
| 是否接真实动作 | **不接**独立「催促」接口（不自动发邮件 / LINE / 短信）。 |
| 前端行为（唯一允许） | **路由型**：跳转客户详情签证域，并锁定主展示案件的 **材料子块**，与现网 `CustomerDetailContextStrip.openMaterials()` 等价：`tab=visa-domain`、`visaDomainBlock=materials`、`materialsVisaCaseId=<主展示案件 id>`，且保留 `pickCustomerDetailDeepLinkPreserve` 相关 query。 |
| 与日志的关系 | 若用户需要 **落笔** 催办说明：使用既有 **「写案件日志」**（`openWriteLog`）或在材料清单内 **单条未收集项记入案件日志**（`CustomerMaterialChecklistTab` 已有预填）。「催促补件」主按钮 **不** 默认打开日志表单，避免与「写案件日志」主 CTA 重复。 |
| 按钮文案与说明 | 使用 i18n：`detailViews.customer.stitchLayout.urgeSupplementCta`、`urgeSupplementTooltip`（见前端 messages）。 |

## 5. 无字段 / 无数据时 UI 策略总表

| UI 元素 | 策略 |
|---------|------|
| 案件担当缺失 | **占位文案**（`unassigned`），保留标签行。 |
| 下次跟进 / 在留期限缺失 | **占位符号** `-`（`formatDate` 空值）。 |
| 通知铃铛、无后端字段的设置 | **隐藏**。 |
| 负责人头像 | **隐藏**（无字段）。 |
| 无主展示案件 | 沿用现有空态：`contextStrip.noPrimaryCase` + 查看全部案件 / 建案向导等（与现网一致）。 |

## 6. 客户详情主 Tab 与台账分段（信息架构）

| 项 | 口径 |
|----|------|
| 主 Tab 行（独占一行） | **仅三项业务 Tab**：**基本信息**、**备忘与跟进**、**签证管理**。其中「签证管理」是否展示仍受 `showVisaDomainTab` 等与现网一致的前置条件控制；条件不满足时主行可为两项，**不得**在同一行混入行政案件或其它台账类入口。 |
| 台账分段行（次行） | 与 **税务 / 财务 / 文件** 等同一段分段控件（`customer-detail-tab-nav__segmented` 等）内，在 `showAdminCasesTab` 为真时 **并入「行政案件」** 入口，与既有台账类 Tab 同一交互范式。 |
| 路由与深链 | **不**改后端；路由 query `?tab=` 与 [`CustomerDetailView.vue`](frontend/src/views/customer/CustomerDetailView.vue) 中既有 `VALID_DETAIL_TABS` **保持不变**；`tab=admin-cases` **仍合法**，仅 **入口从主 Tab 行移至台账分段行**，避免主行与台账层级混淆。 |
| 窄屏与可访问性（主行） | 主行 Tab **不换行**（`flex-wrap: nowrap`），标签区域在视口不足时 **横向滚动**，避免字重被压碎或不可点。滚动容器须具备 **可读的 `aria-label`**（与 i18n 一致）；各主行 **`role="tab"`** 按钮具备 **`focus-visible` 焦点环**；顶栏 **`role="tablist"`** 标注 **`aria-orientation="horizontal"`**。 |

## 7. 签证域主栏堆叠顺序与宽屏栅格（信息架构）

| 项 | 口径 |
|----|------|
| 纵向顺序（自上而下） | **基本信息快照** `#visa-domain-basic-snapshot`（固定首块，仅签证域；与下方可滚动分区导航的关系由前端与 [`VISA_DOMAIN_BLOCK_KEYS`](frontend/src/utils/customer-detail-visa-domain-deeplink.ts) 对齐实现）→ **家属** `family` → **材料清单** `materials` → **资料路径** `paths` → **案件** `cases`（主展示摘要 + 全部案件入口）→ **案件日志** `logs`。 |
| 与 Stitch 稿 | 对齐「信息卡 → 家属 → 清单 → 资料路径」；案件块承载主档级摘要与列表，置于路径之后；日志块置底，与右侧 Rail 的分工见 **§8**。 |
| 深链与常量 | 调整 **DOM 节点顺序** 须同步：[`CustomerVisaDomainTab.vue`](frontend/src/views/customer/components/CustomerVisaDomainTab.vue) 模板节点顺序、`VISA_DOMAIN_BLOCK_KEYS` 字面量顺序、懒加载 / `IntersectionObserver`、`customer-detail-visa-domain-deeplink.spec.ts` 等，保证 `visaDomainBlock`、hash `#visa-domain-*` 与分区导航与 DOM 一致。 |
| 宽屏主栏双栏（仅 CSS） | 在视口宽度满足壳层宽屏断点（建议 **≥1200px**，与 [`CustomerDetailView.scoped.scss`](frontend/src/views/customer/CustomerDetailView.scoped.scss) 中 `customer-detail-body-grid--with-aside` 等主栏栅格一致）时，允许签证域 **主栏内部** 使用 **CSS Grid** 将已有 `visa-domain-tab__section`（或等价区块容器）**分列展示**，以降低整页纵向滚动。**必须**：各区块在 **DOM 中的先后顺序**、各节 **`id`（`#visa-domain-*`）**、**`visaDomainBlock` 与 `VISA_DOMAIN_BLOCK_KEYS`** 与上表 **纵向语义顺序** 保持契约一致；仅允许通过 `grid-column` / `grid-row` 等在网格上 **定位** 已有节点。**禁止**为双栏视觉效果改写模板中的节点书写顺序，以免破坏深链、懒加载、`IntersectionObserver` 与测试。宽屏下列内允许 `overflow-y: auto` 与 `min-height: 0`，避免撑破视口；**「一屏零滚动」不作为硬指标**。 |
| Rail 与双栏 | 右侧 [`CustomerDetailCaseLogRail.vue`](frontend/src/views/customer/components/CustomerDetailCaseLogRail.vue) 属壳层 aside，**不参与**主栏左/右列映射；双栏 **仅** 作用于签证 Tab **主栏** 内，与 **§8** 双入口口径一致。 |

## 8. 宽屏：主栏「案件日志」与右侧 Case Log Rail

| 项 | 口径 |
|----|------|
| 是否互斥隐藏 | **否** — **保留双入口**：宽屏同时展示右侧 [`CustomerDetailCaseLogRail.vue`](frontend/src/views/customer/components/CustomerDetailCaseLogRail.vue) 与主栏 `#visa-domain-logs`。 |
| 分工 | **Rail**：时间轴扫读、`logType` 等筛选、「查看全部」类入口。**主栏 logs**：保留与现网一致的完整能力（含深链 `visaDomainBlock=logs`、写日志与内嵌列表），避免仅依赖 Rail 时在窄屏或深链场景下行为分叉。 |
| 重复感 | 若需减轻视觉重复，允许 **P1+** 对主栏日志块做 **样式降权或默认折叠**；**不**在未单独评审的情况下对宽屏做 DOM 级「只显示其一」。 |

## 9. 实现侧索引

- 类型：`frontend/src/types/customer.ts` — `CustomerListPrimaryVisaCaseSummary`
- 深链与保留 query：`frontend/src/utils/customer-detail-return-navigation.ts`
- 材料子块跳转：`CustomerDetailContextStrip.vue` — `openMaterials()`
- 文案：`frontend/src/i18n/messages/zh-CN.ts`、`ja.ts` — `detailViews.customer.stitchLayout.*`（Stitch 专用）、`detailViews.customer.contextStrip.*`（既有）
- 主 Tab / 台账分段：`docs/36` **§6**；组件：`CustomerDetailTabNav.vue`
- 签证域堆叠、宽屏主栏栅格与双入口：`docs/36` **§7–§8**；组件：`CustomerVisaDomainTab.vue`、`CustomerDetailCaseLogRail.vue`
- 壳层圆角 / 阴影 / 间距 token：`CustomerDetailView.scoped.scss` 内 `.customer-detail-shell` 上的 `--customer-detail-*` 变量；签证域子样式见 `CustomerVisaDomainTab.scoped.scss`、`CustomerDetailCaseLogRail.vue`（均带 fallback，避免脱离壳层时崩样式）。

---

**版本**：Stitch 阶段 0 + **§6 主 Tab 三项（基本信息 / 备忘与跟进 / 签证）+ 行政案件入台账分段 + 主行 nowrap/滚动与 a11y**、**§7 堆叠顺序与宽屏主栏 CSS 双栏（DOM / `#visa-domain-*` / `visaDomainBlock` 不变）**、**§8 日志双入口** 已冻結；后续若增加通知中心或担当头像字段，应修订本文件并保留兼容说明。
