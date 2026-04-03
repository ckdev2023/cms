import { BadRequestException } from '@nestjs/common';

import { AdminCaseStatus } from '../../common/constants/enums';

/**
 * 约束行政案件状态流转的允许路径，避免控制器和服务层各自维护分散规则。
 */
const STATUS_TRANSITIONS: Record<AdminCaseStatus, AdminCaseStatus[]> = {
  [AdminCaseStatus.DRAFT]: [
    AdminCaseStatus.ACCEPTED,
    AdminCaseStatus.CANCELLED,
  ],
  [AdminCaseStatus.ACCEPTED]: [
    AdminCaseStatus.MATERIAL_PENDING,
    AdminCaseStatus.CANCELLED,
  ],
  [AdminCaseStatus.MATERIAL_PENDING]: [
    AdminCaseStatus.SUBMITTED,
    AdminCaseStatus.CANCELLED,
  ],
  [AdminCaseStatus.SUBMITTED]: [
    AdminCaseStatus.APPROVED,
    AdminCaseStatus.REJECTED,
  ],
  [AdminCaseStatus.APPROVED]: [AdminCaseStatus.COMPLETED],
  [AdminCaseStatus.REJECTED]: [
    AdminCaseStatus.MATERIAL_PENDING,
    AdminCaseStatus.CANCELLED,
  ],
  [AdminCaseStatus.COMPLETED]: [],
  [AdminCaseStatus.CANCELLED]: [],
};

/**
 * 校验行政案件状态是否允许从当前值切换到目标值。
 *
 * @param currentStatus - 当前案件状态
 * @param nextStatus - 目标案件状态
 * @throws {BadRequestException} 当前状态不允许切换到目标状态时
 */
export function assertAdminCaseStatusTransition(
  currentStatus: AdminCaseStatus,
  nextStatus: AdminCaseStatus,
): void {
  const allowedTransitions = STATUS_TRANSITIONS[currentStatus] ?? [];

  if (!allowedTransitions.includes(nextStatus)) {
    throw new BadRequestException(
      `ステータスを「${currentStatus}」から「${nextStatus}」に変更できません`,
    );
  }
}

/**
 * 返回指定行政案件状态当前允许切换的下一步状态集合。
 *
 * @param status - 当前案件状态
 * @returns 可供前端状态下拉框展示的目标状态列表
 */
export function getAdminCaseAvailableTransitions(
  status: AdminCaseStatus,
): AdminCaseStatus[] {
  return [...(STATUS_TRANSITIONS[status] ?? [])];
}
