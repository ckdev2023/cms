import { VisaCaseLogType } from '@/constants/enums'

/**
 * 客户详情右侧案件日志预览（Stitch rail）四类筛选 pill 与 `VisaCaseLogType` 的归类映射。
 *
 * - **材料**：提交/补件类日志（`SUBMISSION`、`SUPPLEMENT`）
 * - **沟通**：跟进与一般说明（`FOLLOW_UP`、`GENERAL`）
 * - **系统**：状态变更等系统轨迹（当前合并 `STATUS_CHANGE`；若后端新增同类枚举可在此扩展）
 */
export type CaseLogRailPillCategory = 'all' | 'materials' | 'communication' | 'system'

/** 单次拉取条数：足够在 pill 过滤后仍有预览意义（后端仅支持单 `logType` 查询，多类型归类走前端过滤）。 */
export const CASE_LOG_RAIL_FETCH_PAGE_SIZE = 40

/** 侧栏最多展示的条数，避免长列表撑满右栏。 */
export const CASE_LOG_RAIL_DISPLAY_LIMIT = 10

/** 各 pill 对应的日志类型集合；`all` 为 `null` 表示不过滤。 */
export const caseLogRailPillLogTypes: Record<
  CaseLogRailPillCategory,
  readonly VisaCaseLogType[] | null
> = {
  all: null,
  materials: [VisaCaseLogType.SUBMISSION, VisaCaseLogType.SUPPLEMENT],
  communication: [VisaCaseLogType.FOLLOW_UP, VisaCaseLogType.GENERAL],
  system: [VisaCaseLogType.STATUS_CHANGE],
}

/**
 * 判断指定 `logType` 是否落入当前 rail pill 分类。
 *
 * @param logType - 单条日志的类型枚举值
 * @param pill - 当前选中的 pill 分类
 * @returns 是否应在此 pill 下展示
 */
export function isVisaCaseLogInRailPill(
  logType: VisaCaseLogType,
  pill: CaseLogRailPillCategory,
): boolean {
  const allowed = caseLogRailPillLogTypes[pill]
  if (allowed === null) {
    return true
  }
  return allowed.includes(logType)
}
