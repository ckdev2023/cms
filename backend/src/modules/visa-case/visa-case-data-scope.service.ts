import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { VisaDataScope } from '../../common/constants/enums';
import type { ResolvedVisaDataScope } from './visa-case-data-scope.types';

type TeamUserRow = { user_id: string };

/**
 * 按 docs/21 §18 将 `dataScope` 解析为可注入查询的 `assigned_to` 条件；`team` 在无团队归属时与 `all` 等价（过渡策略）。
 */
@Injectable()
export class VisaCaseDataScopeService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * 将查询枚举与当前用户 ID 解析为统一的数据范围结构，供列表与聚合复用。
   *
   * @param currentUserId - 当前登录用户主键
   * @param dataScope - 请求可选范围；缺省或与 `all` 等价时不收窄
   * @returns `mine` / `team` / `all` 之一对应的结构化结果
   */
  async resolve(
    currentUserId: string,
    dataScope?: VisaDataScope,
  ): Promise<ResolvedVisaDataScope> {
    const scope = dataScope ?? VisaDataScope.ALL;
    if (scope === VisaDataScope.ALL) {
      return { mode: 'all' };
    }
    if (scope === VisaDataScope.MINE) {
      return { mode: 'mine', userId: currentUserId };
    }

    const rows = await this.dataSource.query<TeamUserRow[]>(
      `SELECT DISTINCT tu2.user_id AS user_id
       FROM team_users tu1
       INNER JOIN team_users tu2 ON tu2.team_id = tu1.team_id
       WHERE tu1.user_id = $1`,
      [currentUserId],
    );

    if (!rows.length) {
      return { mode: 'all' };
    }

    const teamAssigneeIds = [
      ...new Set(rows.map((r) => r.user_id).filter(Boolean)),
    ];
    if (!teamAssigneeIds.includes(currentUserId)) {
      teamAssigneeIds.push(currentUserId);
    }
    return { mode: 'team', currentUserId, teamAssigneeIds };
  }
}
