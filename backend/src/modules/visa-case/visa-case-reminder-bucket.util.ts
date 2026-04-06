import { VisaCaseStatus, VisaReminderType } from '../../common/constants/enums';
import { VisaCase } from './entities/visa-case.entity';
import { calendarDaysUntil, formatLocalDateYyyyMmDd } from './visa-case.mapper';

/**
 * 按优先级为单个案件选定唯一提醒桶：
 * SUPPLEMENT > TODAY_FOLLOW_UP > EXPIRING_7_DAYS > EXPIRING_2_MONTHS。
 *
 * @param vc - 签证案件实体
 * @param today - 当前日期基准
 * @param todayStr - 当前日期 YYYY-MM-DD
 * @param supplementLogIds - 最新日志指示补件的案件 ID 集合
 * @returns 命中的提醒桶，全不命中时返回 null
 */
export function resolveVisaReminderBucket(
  vc: VisaCase,
  today: Date,
  todayStr: string,
  supplementLogIds: Set<string>,
): VisaReminderType | null {
  if (
    vc.caseStatus === VisaCaseStatus.SUPPLEMENT ||
    supplementLogIds.has(vc.id)
  ) {
    return VisaReminderType.SUPPLEMENT;
  }

  if (vc.nextFollowUpAt) {
    const followUpStr = formatLocalDateYyyyMmDd(vc.nextFollowUpAt);
    if (followUpStr === todayStr) {
      return VisaReminderType.TODAY_FOLLOW_UP;
    }
  }

  if (vc.expireDate) {
    const days = calendarDaysUntil(vc.expireDate, today);
    if (days <= 7) return VisaReminderType.EXPIRING_7_DAYS;
    if (days <= 60) return VisaReminderType.EXPIRING_2_MONTHS;
  }

  return null;
}
