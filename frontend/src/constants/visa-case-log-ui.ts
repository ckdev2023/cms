import { VisaCaseLogType } from '@/constants/enums'

/**
 * 与 `el-tag` / `el-timeline-item` 的 `type` 及 `.visa-case-log-timeline-tone--*`（见 `styles/visa-case-log-timeline-tone.scss`）共用的色系键。
 */
export type VisaCaseLogTimelineTone =
  | 'primary'
  | 'success'
  | 'warning'
  | 'info'
  | 'danger'

/**
 * 案件日志业务类型 → 时间线节点与标签共用的 Element Plus 色系，与业务语义对齐（补件 warning、跟进 success、提交 primary 等）。
 */
export const visaCaseLogTimelineTagType = {
  [VisaCaseLogType.SUBMISSION]: 'primary',
  [VisaCaseLogType.SUPPLEMENT]: 'warning',
  [VisaCaseLogType.FOLLOW_UP]: 'success',
  [VisaCaseLogType.STATUS_CHANGE]: 'info',
  [VisaCaseLogType.GENERAL]: 'info',
} as const satisfies Record<VisaCaseLogType, VisaCaseLogTimelineTone>

/**
 * 解析任意后端日志类型字符串为时间线设色 tone；未知值回退为 `info`，与历史 `el-tag` 行为一致。
 *
 * @param logType - 日志类型枚举字符串
 * @returns Rail 节点 class 后缀与 `el-timeline-item` `type` 可用的 tone
 */
export function visaCaseLogTimelineToneForLogType(logType: string): VisaCaseLogTimelineTone {
  return (
    (visaCaseLogTimelineTagType as Record<string, VisaCaseLogTimelineTone>)[logType] ?? 'info'
  )
}

/**
 * 与 {@link visaCaseLogTimelineToneForLogType} 同实现，供模板、`el-timeline-item` / `el-tag` 的 `type` 解析使用。
 */
export const resolveVisaCaseLogTimelineEpType = visaCaseLogTimelineToneForLogType

/**
 * 产品计划文档中的命名：与 {@link visaCaseLogTimelineToneForLogType} 同实现，Rail 与主栏时间轴共用。
 */
export const resolveVisaCaseLogTimelineVisualTone = visaCaseLogTimelineToneForLogType
