import { VisaAlertLevel } from '../../common/constants/enums';

/**
 * 计算目标日期距今日的自然日差（不含时刻），用于在留期限到期提醒判定。
 *
 * @param expireDate - 在留期限日（仅使用日期部分，忽略时刻）
 * @param today - 当前日期基准，默认取系统当天
 * @returns 到期日与今日之间的自然日差（正值表示未到期，负值表示已过期）
 */
export function calendarDaysLeft(
  expireDate: Date,
  today: Date = new Date(),
): number {
  const expire = Date.UTC(
    expireDate.getFullYear(),
    expireDate.getMonth(),
    expireDate.getDate(),
  );
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((expire - now) / 86_400_000);
}

/**
 * 按冻结口径将剩余天数映射为签证提醒等级。
 *
 * 规则（docs/20 §4.3）：
 * - daysLeft < 0 → EXPIRED
 * - 0 <= daysLeft <= 7 → URGENT
 * - 8 <= daysLeft <= 30 → HIGH
 * - 31 <= daysLeft <= 90 → NORMAL
 * - daysLeft > 90 → null（不进入提醒列表）
 *
 * @param daysLeft - 到期剩余自然日数
 * @returns 提醒等级枚举值，超出 90 天范围时返回 null
 */
export function resolveVisaAlertLevel(daysLeft: number): VisaAlertLevel | null {
  if (daysLeft < 0) return VisaAlertLevel.EXPIRED;
  if (daysLeft <= 7) return VisaAlertLevel.URGENT;
  if (daysLeft <= 30) return VisaAlertLevel.HIGH;
  if (daysLeft <= 90) return VisaAlertLevel.NORMAL;
  return null;
}

/**
 * 在本地日历上为基准日增加若干自然日，用于计算在留提醒查询的截止日期。
 *
 * @param base - 基准日期（仅年月日参与运算，与当前时刻无关）
 * @param days - 要增加的自然日数（可为负）
 * @returns 运算后的本地日历日期对象（时刻为 00:00:00.000 本地）
 */
export function addCalendarDaysLocal(base: Date, days: number): Date {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * 将日期格式化为本地日历的 YYYY-MM-DD，避免 toISOString 按 UTC 截断导致与 date 列比较有日界偏差。
 *
 * @param d - 待格式化的日期（通常由 addCalendarDaysLocal 或当日零点构造）
 * @returns 与 PostgreSQL date 比较安全的日期字符串
 */
export function formatLocalDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
