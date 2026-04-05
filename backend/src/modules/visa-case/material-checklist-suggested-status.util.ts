import { MaterialStatus } from '../../common/constants/enums';

/**
 * 根据 checklist 项计数推导建议的 `material_status`，算法与 `VisaCaseMaterialService.getSummary` 保持一致。
 *
 * @param collected - 状态为 COLLECTED 的项数
 * @param notApplicable - 状态为 NOT_APPLICABLE 的项数
 * @param totalItemCount - 清单项总数
 * @returns 建议写入 `visa_cases.material_status` 的枚举值
 */
export function computeSuggestedMaterialStatusFromChecklistCounts(
  collected: number,
  notApplicable: number,
  totalItemCount: number,
): MaterialStatus {
  const safeTotal = Math.max(0, Math.trunc(totalItemCount));
  const safeCol = Math.max(0, Math.trunc(collected));
  const safeNa = Math.max(0, Math.trunc(notApplicable));
  const notCollected = Math.max(0, safeTotal - safeCol - safeNa);
  const applicableTotal = safeCol + notCollected;
  if (applicableTotal === 0) {
    return MaterialStatus.NOT_RECEIVED;
  }
  if (safeCol === applicableTotal) {
    return MaterialStatus.COMPLETE;
  }
  if (safeCol > 0) {
    return MaterialStatus.PARTIAL;
  }
  return MaterialStatus.NOT_RECEIVED;
}
