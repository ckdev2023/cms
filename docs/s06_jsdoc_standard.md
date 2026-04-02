# S06 — 方法级 JSDoc 书写标准

## 概要

本文件定义项目全体の方法级 JSDoc 书写标准。目标是让每个函数/方法都携带足够信息，使 AI 接手、代码评审和后续维护都能在不阅读实现细节的前提下理解其用途、输入、输出和影响范围。

本标准对前端（Vue 3 + TypeScript）和后端（NestJS + TypeScript）统一适用。

## 强制范围

### 前端

下表列出所有 JSDoc 要求的目录和场景。"门禁"列标注该要求是否由自动化工具（ESLint / check-jsdoc.mjs）在 pre-commit 或 CI 中实际执行：

| 目录 | 说明 | 门禁 |
|------|------|------|
| `frontend/src/stores/` | Pinia store 内所有导出函数和 action | **error** — ESLint Layer 1 + Layer 2 |
| `frontend/src/utils/` | 工具函数 | **error** — ESLint Layer 1 + Layer 2 |
| `frontend/src/api/` | API 调用函数 | **error** — ESLint Layer 1 + Layer 2 |
| `frontend/src/composables/` | 组合式函数的工厂函数及其返回的公开方法 | warn — ESLint Layer 1 + Layer 2 |
| `frontend/src/directives/` | 自定义指令中的权限判定、DOM 状态同步等业务函数 | warn — ESLint Layer 1 + Layer 2 |
| `frontend/src/constants/` | 含业务转换逻辑的常量构造函数与本地化映射工厂 | warn — ESLint Layer 1 + Layer 2 |
| `frontend/src/i18n/` | 国际化入口、语言切换辅助函数、翻译读取函数 | warn — ESLint Layer 1 + Layer 2 |
| `frontend/src/router/` | 路由守卫、鉴权跳转和路由元信息辅助函数 | warn — ESLint Layer 1 + Layer 2 |
| `frontend/src/types/` | 类型声明文件顶部须有模块说明注释，说明该文件承载的业务契约范围 | Layer 2 质量检查 |
| `.vue` 组件内业务方法 | `<script setup>` 中 6 行以上的具名函数声明（`function foo() {}`）。箭头函数、生命周期回调、watch 回调、5 行及以下的简短处理函数自动豁免 | warn — ESLint Layer 1（仅具名函数声明，minLineCount ≥ 6） |

> **`.vue` 说明**：ESLint Layer 1 已覆盖 `.vue` 文件中 6 行以上的具名函数声明，等级为 **warn**（不阻断提交，仅提示）。此设计刻意保守：`<script setup>` 内大量箭头函数、事件处理器和回调不在检查范围内，避免低价值噪音。Layer 2（`check-jsdoc.mjs`）当前不解析 `.vue` 文件（见下方评估结论）。后续升级路线见 `docs/s19_rollout_order.md` Wave 7b。
>
> **Layer 2 对 `.vue` 的评估结论**：暂不扩展。原因：(1) Layer 1 已提供存在性与结构检查；(2) `.vue` JSDoc 处于 `warn` 试运行阶段，积累有效 JSDoc 后再评估质量检查价值；(3) `check-jsdoc.mjs` 的正则解析器需新增 `<script setup>` 提取逻辑，复杂度高于收益。待 `.vue` Layer 1 升级为 `error` 且库内 `.vue` JSDoc 覆盖率达 50% 以上时，再重新评估 Layer 2 扩展。

### 后端

| 目录 | 说明 |
|------|------|
| `backend/src/modules/*/*.service.ts` | Service 类的所有 public 和 private 方法 |
| `backend/src/modules/*/*.controller.ts` | Controller 类的路由处理方法 |
| `backend/src/modules/auth/guards/` | Guard 的 `canActivate` 及辅助方法 |
| `backend/src/common/interceptors/` | Interceptor 的 `intercept` 及辅助方法 |
| `backend/src/common/helpers/` | Helper 类的所有静态/实例方法 |
| `backend/src/common/filters/` | Exception filter 的 `catch` 及辅助方法 |

### 豁免项

以下不强制要求 JSDoc（但鼓励编写）：

- 单行箭头函数形式的简单 getter/computed（如 `const isLoggedIn = computed(() => !!token.value)`）。
- 生命周期钩子（`onMounted` 等）的回调函数。
- 测试文件中的 `describe`/`it` 回调。
- 仅做 re-export 的 `index.ts` 文件。
- 由框架签名严格约束且无额外逻辑的单行方法（如 NestJS 空 constructor）。
- 纯翻译字典文件中的静态消息对象（如 `i18n/messages/*.ts` 的 locale 数据）。
- `frontend/src/types/index.ts` 这类纯聚合导出文件。

## 必填字段

每个方法的 JSDoc 注释块必须包含以下字段：

| # | 字段 | 标签 | 何时可省略 |
|---|------|------|-----------|
| 1 | **用途描述** | 正文首行（无标签） | 不可省略 |
| 2 | **参数说明** | `@param` | 方法无参数时 |
| 3 | **返回值说明** | `@returns` | 方法返回 `void` / `Promise<void>` 时 |
| 4 | **副作用 / 约束** | `@throws` / `@sideeffect` / 正文补充 | 方法无副作用、无异常、无权限要求时 |

### 字段详解

### 1. 用途描述（正文首行）

写在 `/**` 之后的第一句话。须回答 **"这个方法做什么，以及为什么需要它"**。

**合格标准：**

- 包含动词 + 业务对象 + 关键限定条件。
- 读者不查看函数签名也能理解大致行为。

**禁止的空泛描述：**

| 不合格 | 原因 |
|--------|------|
| `处理数据` | 无法区分是查询、转换、持久化还是删除 |
| `获取信息` | 未说明获取什么信息、从哪里获取 |
| `执行操作` | 完全没有信息量 |
| `Helper method` | 未说明辅助什么 |
| `初始化` | 未说明初始化什么状态 |

### 2. 参数说明（`@param`）

每个参数一行。格式：

```
@param paramName - 参数的含义和约束
```

**要求：**

- 说明参数在业务中的含义，不只是重复类型名。
- 如果参数有特殊约束（如非空、范围、格式），须在描述中注明。
- 对象类型参数如果字段含义不明显，应逐字段补充说明或引导读者查看类型定义。
- 可选参数需说明省略时的默认行为。

### 3. 返回值说明（`@returns`）

格式：

```
@returns 返回内容的含义
```

**要求：**

- 说明返回值在业务上代表什么，不只是重复类型签名。
- 如果返回 `null` / `undefined` 有特殊含义（如"未找到"），须注明。
- Promise 类型说明解析后的值。

### 4. 副作用 / 约束

涵盖以下任一情况时必须说明：

| 情况 | 推荐写法 |
|------|---------|
| 会抛出异常 | `@throws {ExceptionType} 触发条件` |
| 修改外部状态（DB、localStorage、全局变量） | 正文中说明 "副作用：..." 或使用 `修改 xxx 状态` 描述 |
| 要求特定权限 | 正文中说明所需权限代码 |
| 依赖外部服务 / 网络请求 | 正文中注明 |
| 事务性操作 | 正文中注明是否在事务内执行 |
| 幂等性 / 并发安全 | 如有要求则说明 |

## 模板

### 模板 A — 标准函数

```typescript
/**
 * 通过用户名和密码验证用户身份，返回匹配的用户实体。
 *
 * 验证失败时记录登录日志。如果连续失败次数达到上限，将锁定账户 30 分钟。
 *
 * @param username - 登录用户名
 * @param password - 明文密码，内部与 bcrypt hash 比对
 * @returns 验证通过的 User 实体；用户名不存在或密码不匹配时返回 null
 * @throws {UnauthorizedException} 账户被锁定或状态为 INACTIVE 时
 */
async validateUser(username: string, password: string): Promise<User | null> {
```

### 模板 B — 无返回值、有副作用

```typescript
/**
 * 变更当前用户密码。
 *
 * 旧密码验证通过后，用 bcrypt 重新加密新密码并持久化到数据库。
 *
 * @param userId - 当前登录用户的 ID
 * @param oldPassword - 用户输入的当前密码（明文）
 * @param newPassword - 用户输入的新密码（明文）
 * @throws {UnauthorizedException} 用户不存在时
 * @throws {BadRequestException} 旧密码验证失败时
 */
async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
```

### 模板 C — Pinia store action

```typescript
/**
 * 调用登录 API 并将凭证写入本地状态。
 *
 * 成功后将 accessToken 存入 localStorage，将用户信息写入 store。
 *
 * @param form - 包含 username 和 password 的登录表单数据
 * @throws {Error} API 返回非零 code 或网络异常时（由 request 层抛出）
 */
async function login(form: LoginForm): Promise<void> {
```

### 模板 D — 组合式函数

```typescript
/**
 * 提供基于 Element Plus MessageBox 的确认对话框快捷方法。
 *
 * @returns 包含 confirm 和 confirmDelete 两个异步方法的对象
 */
export function useConfirm() {
```

组合式函数返回的公开方法也须注释：

```typescript
/**
 * 弹出确认对话框，等待用户操作。
 *
 * @param options - 对话框配置，传入字符串时作为 message 使用
 * @returns 用户点击确认时为 true，取消或关闭时为 false
 */
async function confirm(options: ConfirmOptions | string): Promise<boolean> {
```

### 模板 E — API 调用函数

```typescript
/**
 * 提交用户登录凭证，获取 accessToken 和用户信息。
 *
 * @param data - 登录表单（username + password）
 * @returns 包含 accessToken 和 user 信息的响应体
 */
export function login(data: LoginForm) {
```

### 模板 F — NestJS Guard

```typescript
/**
 * 基于路由元数据中声明的权限代码，校验当前用户是否有权访问。
 *
 * 支持三级匹配：全局通配符 `*`、模块通配符 `mod:*`、精确权限码。
 * 标记为 @Public() 的路由直接放行。
 *
 * @param context - NestJS 执行上下文，用于提取请求对象和路由元数据
 * @returns 有权限时返回 true
 * @throws {ForbiddenException} 用户未认证或权限不足时
 */
async canActivate(context: ExecutionContext): Promise<boolean> {
```

### 模板 G — 私有辅助方法

```typescript
/**
 * 从 User 实体中提取前端所需的用户概要信息。
 *
 * 将角色列表展开为权限码集合，去重后返回扁平结构。
 *
 * @param user - 已加载 roles 和 roles.permissions 关联的用户实体
 * @returns 包含 id、username、displayName、roles、permissions 的扁平对象
 */
private buildUserInfo(user: User) {
```

### 模板 H — 静态工具方法

```typescript
/**
 * 构造标准成功响应体。
 *
 * @param data - 业务数据载体
 * @param message - 响应消息，默认 'success'
 * @returns 符合 IApiResponse 结构的响应对象
 */
static success<T>(data: T, message = 'success'): IApiResponse<T> {
```

## 注释块格式规范

### 类型文件顶部说明

`frontend/src/types/*.ts` 中承载业务契约的文件，须在首个导入或声明之前放置顶部说明注释，格式与 JSDoc 一致：

```typescript
/**
 * 定义客户档案、备注与客户补充信息的声明类型。
 */
```

要求：

- 说明该文件服务的业务模块或复用场景。
- 仍需满足中文描述、最少 8 个有效字符、不得使用空泛词。
- `index.ts` 纯 re-export 文件可省略。

### 位置

JSDoc 注释块必须紧贴在函数/方法声明之前，中间不得有空行或其他语句。

### 行宽

单行描述不超过 100 字符。超过时换行，续行缩进 1 个空格与 `*` 对齐。

### 语言

- 用途描述和参数说明统一使用**中文**。
- 标签关键字（`@param`、`@returns`、`@throws`）保持英文。
- 异常类名保持代码原名（如 `UnauthorizedException`）。

### 段落

- 正文首行为一句话摘要。
- 如需补充说明，空一行后再写详细段落。
- `@param` / `@returns` / `@throws` 之间不需要空行。

### 格式示例

```typescript
/**
 * 一句话摘要（动词开头，句号结尾）。
 *
 * 补充说明段落，如需要可以多行。
 * 解释算法选择、并发考量、业务规则等。
 *
 * @param foo - 参数说明
 * @param bar - 参数说明
 * @returns 返回值说明
 * @throws {SomeException} 触发条件
 */
```

## 质量判断标准

以下标准用于自动检查和人工评审：

### 通过条件

1. **存在性**：强制范围内的函数/方法有 `/** ... */` 注释块。
2. **摘要有效**：正文首行不少于 8 个字符（去除标点和空格），且不匹配空泛词库。
3. **参数覆盖**：每个非 `_` 前缀参数都有对应的 `@param` 行。
4. **返回值覆盖**：非 void 返回的函数有 `@returns` 行。
5. **异常覆盖**：函数体内包含 `throw` 语句时，有至少一个 `@throws` 行。

### 空泛词黑名单

以下词汇如果单独构成完整描述（不含其他实义修饰），视为不合格：

```
处理, 获取, 设置, 执行, 操作, 初始化, 处理数据, 获取信息,
处理请求, 辅助方法, Helper, Process, Handle, Get data,
Execute, Initialize, Do something
```

## 与后续任务的衔接

| 后续任务 | 本标准提供的输入 |
|---------|----------------|
| **S07** — JSDoc 检查实现方案 | 上述"质量判断标准"作为自动化检查的规则定义 |
| **S08** — JSDoc 强制范围确认 | 上述"强制范围"表格作为检查脚本的目标路径配置 |
| **S01/S04** — verify 管道 | JSDoc 检查作为 `jsdoc:check` 脚本接入 `verify:fast` |
| **S05** — ESLint 规则集 | 可配合 `eslint-plugin-jsdoc` 实现存在性检查层 |
