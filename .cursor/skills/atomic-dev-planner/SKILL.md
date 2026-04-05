---
name: atomic-dev-planner
description: create a development plan and split it into atomic task documents that can be executed independently in fresh chat windows. use when the user has a requirement, prd, design, solution outline, or repo context and wants a master implementation plan plus separate task files that minimize context drift, scope creep, and model degradation over long conversations. especially useful for ai coding workflows where each task must be self-contained, bounded, testable, reversible, and high quality.
---

# Atomic Dev Planner

Create a development plan that is optimized for execution by a coding model in separate fresh windows.

Your job is not just to break work down. Your job is to produce:
1. one master plan that preserves global intent
2. a set of atomic task documents that can each be executed on their own without relying on earlier chat history

## Core workflow

Follow this sequence:

1. Read the user's requirement, design, or repo context.
2. Infer the target outcome, constraints, boundaries, and likely risks.
3. Normalize the scope before task splitting.
4. Build the master plan around workstreams, dependencies, and delivery order.
5. Split work into atomic tasks using the atomicity rules below.
6. Write one standalone task document per task (default: as files under `plans/<子目录>/`; see「落盘到仓库」).
7. Run the quality gate before finalizing.

If the input is incomplete, make conservative assumptions and label them clearly instead of blocking.

## Planning goals

Optimize for these goals in this order:

1. independent execution in a new window
2. low context load per task
3. explicit boundaries and stop conditions
4. testability and acceptance clarity
5. reversibility and safe iteration
6. minimal hidden dependencies

## Atomicity rules

A task is atomic only if all of the following are true:

- It has one primary objective.
- It can be executed without needing the full previous conversation.
- It touches a narrow and explicit change surface.
- It has a clear completion test.
- It has a clear stop condition.
- Failure can be isolated without invalidating the entire plan.
- It does not bundle unrelated refactors or opportunistic cleanup.

Do not create tasks like:
- implement the whole user center
- finish backend changes
- optimize database and tests
- complete all remaining work

Prefer tasks like:
- add profile query dto and response contract
- implement get profile api endpoint
- connect profile page to the new endpoint
- add profile endpoint unit tests
- add index for user profile lookup

## Window-safe task design rules

Every task document must be self-contained.

That means each task document must:
- restate the local objective
- include only the minimum required background
- name the affected modules or files if known
- explicitly state what is out of scope
- avoid phrases like "as discussed above" or "continue from previous step"
- avoid requiring hidden memory from the master plan

Keep task context compact. Include enough information to execute well, but do not overload the task with broad system history that is not needed.

## Output package

Default to producing these sections in this order.

### 1) Master plan

Use this exact heading:

# 00-开发总计划

Include these sections:
- 目标与交付结果
- 背景与关键假设
- 范围与非范围
- 工作流/阶段划分
- 依赖关系与建议顺序
- 风险与决策点
- 原子任务清单

### 2) Task documents

Create one section per task using this heading pattern:

# 01-任务-[slug]
# 02-任务-[slug]
# 03-任务-[slug]

Each task document must follow the template in `references/task-document-template.md`.

If useful, group tasks by phase in the master plan, but keep each task document individually executable.

### 落盘到仓库（默认）

当用户要求生成可执行开发计划时，除在对话中给出**简短索引**（目录路径 + 文件列表 + 依赖顺序要点）外，**默认在仓库内写入 Markdown 文件**，便于 PR、回溯与在新窗口用 `@文件` 引用。

- **根目录**：仓库根下 `plans/`（若不存在则创建）。
- **子目录**：`plans/<一次规划 run>/`，命名优先 `YYYY-MM-DD-<主题简写>`（kebab-case，简写用英文或拼音均可但要一致）；若用户已指定需求编号、里程碑名或分支代号，可用该标识替代或与日期组合。
- **主计划文件**：`00-开发总计划.md`，正文结构与上文「Master plan」一致（含 `# 00-开发总计划` 标题及所列小节）。
- **任务文件**：每个原子任务单独一个文件，文件名与标题序号一致，例如 `01-任务-<slug>.md`、`02-任务-<slug>.md`；正文遵循 `references/task-document-template.md`，且须自洽、不依赖同轮对话历史。
- **同一次交付**的所有文件必须落在**同一** `plans/<一次规划 run>/` 目录下，勿散落到多处。
- **例外**：若用户**明确声明只要聊天输出、不要写文件**，则跳过落盘，仅在回复中输出全文（或按用户指定粒度输出）。

## Task sizing guidance

Prefer tasks that a coding agent can complete in one focused run.

As a rule of thumb, a task should usually fit one of these patterns:
- one contract or interface change
- one endpoint or one UI slice
- one migration or one index change
- one test batch for one behavior area
- one wiring/integration step
- one deployment or observability adjustment

Split further when a task would otherwise:
- modify too many modules
- mix design and implementation
- mix implementation and large-scale refactor
- require multiple independent acceptance criteria
- exceed a compact execution brief

## Dependency rules

Mark dependencies explicitly.

Use these labels where useful:
- blocked by
- can run in parallel with
- must follow
- optional follow-up

Do not invent unnecessary serial ordering. If two tasks can run independently, say so.

## Assumptions and unknowns

When the input is ambiguous:
- state assumptions in the master plan
- propagate only the relevant local assumptions into each task doc
- add a stop condition when execution would be unsafe without clarification

## Quality gate

Before finalizing, verify every task against this checklist:

- Is the objective singular?
- Is the task self-contained for a fresh window?
- Is the change surface explicit?
- Are forbidden edits listed?
- Are acceptance criteria concrete?
- Is there a self-test checklist?
- Is there a rollback or reversal note?
- Is there a stop condition?
- Would this task reduce, not increase, context burden during execution?

If the answer is no for any item, revise the split.

## Style rules

- Write in Chinese.
- Be concrete and execution-oriented.
- Prefer short bullet points over long essays inside task docs.
- Use precise nouns: module names, api names, table names, page names, test types.
- Separate background from instructions.
- Do not write inspirational or managerial filler.
- Do not produce pseudo-atomic tasks that hide multiple changes behind one title.

## Output behavior

When the user asks to generate a plan from provided inputs, **by default write the master plan and each task file under `plans/<一次规划 run>/`** as specified in「落盘到仓库」, then reply with a concise index (paths, execution order, any blockers). If writing files is impossible or the user opted out of filesystem output, deliver the same content in the message instead.

When the user asks only for a template or framework, provide the reusable template without pretending project specifics (no `plans/` writes unless they explicitly ask to save a template file).

When the user gives an existing plan and asks to improve it, rewrite it into the master-plan-plus-task-documents structure and **prefer saving the updated package under a new or same `plans/<run>/` directory** per user instruction; if none given, use a new dated run directory to preserve history.

## Example triggers

Use this skill for requests like:
- 把这个需求拆成适合 ai 执行的开发计划
- 生成一个开发总计划和多个原子任务文档
- 把设计稿拆成每个新窗口都能单独执行的 task
- 把大需求拆成避免上下文降智的执行包
- 重写这个实现计划，让每个任务都可验收可回滚

## References

- Use `references/task-document-template.md` for every task document.
- Use `references/master-plan-checklist.md` as a final review checklist when the plan is complex.
