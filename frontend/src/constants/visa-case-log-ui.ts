import { VisaCaseLogType } from '@/constants/enums'

/**
 * 案件日志时间线卡片上 `el-tag` 的类型映射，与日志业务类型语义对齐。
 */
export const visaCaseLogTimelineTagType: Record<
  string,
  'success' | 'warning' | 'info' | 'danger' | 'primary'
> = {
  [VisaCaseLogType.SUBMISSION]: 'primary',
  [VisaCaseLogType.SUPPLEMENT]: 'warning',
  [VisaCaseLogType.FOLLOW_UP]: 'success',
  [VisaCaseLogType.STATUS_CHANGE]: 'info',
  [VisaCaseLogType.GENERAL]: 'info',
}
