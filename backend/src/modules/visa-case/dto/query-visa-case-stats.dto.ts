import { ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

import { QueryGlobalVisaCaseListDto } from './query-global-visa-case-list.dto';

/** 与登记册列表共用、且可传入 `GET /visa-cases/stats` 的筛选字段（不含分页与排序）。 */
const VISA_CASE_STATS_FILTER_KEYS = [
  'customerId',
  'customerKeyword',
  'caseStatuses',
  'assignedToIds',
  'unassignedOnly',
  'materialStatuses',
  'feeStatuses',
  'expireDateFrom',
  'expireDateTo',
  'nextFollowUpAtFrom',
  'nextFollowUpAtTo',
  'isFamilyCase',
  'familyLinkMode',
  'supplementRelated',
  'reminderBucket',
  'dataScope',
  'keyword',
] as const;

/**
 * 签证域只读统计查询参数：与跨客户列表 `GET /visa-cases` 共用同一套筛选键（无 page/pageSize），
 * 以便登记册表格与 KPI 面板对账；另保留 `assignedTo` 单一 UUID 以兼容工作台等旧调用。
 *
 * 未传负责人类条件时：状态分布覆盖全部非软删案件；提醒相关 KPI 在未完结未取消子集上计算（见实现层）。
 */
export class QueryVisaCaseStatsDto extends PickType(
  QueryGlobalVisaCaseListDto,
  VISA_CASE_STATS_FILTER_KEYS,
) {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      '按单一负责人收窄统计范围；与 `assignedToIds` 同时出现时以 `assignedToIds` 与 `unassignedOnly` 为准',
  })
  @IsOptional()
  @IsUUID('4', { message: '担当者IDの形式が無効です' })
  assignedTo?: string;
}
