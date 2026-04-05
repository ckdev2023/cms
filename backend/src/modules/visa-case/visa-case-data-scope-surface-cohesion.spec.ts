/**
 * Phase F — F1a / F1b：签证域多接口共用 `VisaCaseDataScopeService.resolve` 与列表/统计同构回归。
 *
 * **结构化手测（管理者 = RBAC 上限 `all`，非独立 query 档位）** — docs/27 §2、§5：
 * - R3：预发用 mine / team 账号各验一条「登记册列表 KPI」与「案件列表 total」。
 * - R4：仅 `dataScopeMine` 时请求 `dataScope=all` → 403（Guard + `assertQueryDataScopeAllowed`）。
 * - R5：scope 外案件详情读 404 / 写 403。
 *
 * 权限上限矩阵自动化见 `visa-case-data-scope-permission.service.spec.ts`。
 */

import { VisaCaseStatus, VisaDataScope } from '../../common/constants/enums';
import type { VisaCase } from './entities/visa-case.entity';
import {
  buildReminderCase,
  createQueryBuilderMock,
  createTestingContext,
} from './visa-case.service.spec-helpers';
import type { VisaDomainStatsDto } from './visa-case.types';
import { VisaCaseReminderService } from './visa-case-reminder.service';

/**
 * 构造 `getVisaDomainStats` 开放案件集合查询链 mock。
 *
 * @param cases - `getMany` 返回值
 * @returns QueryBuilder 链 mock
 */
function createStatsOpenCasesQbMock(
  cases: Record<string, unknown>[],
): Record<string, jest.Mock> {
  return {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(cases),
  };
}

/**
 * 构造 `GROUP BY case_status` 统计链 mock。
 *
 * @param rows - `getRawMany` 返回值
 * @returns QueryBuilder 链 mock
 */
function createStatsGroupByQbMock(
  rows: Record<string, string>[],
): Record<string, jest.Mock> {
  return {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(rows),
  };
}

/**
 * 构造未指派计数链 mock。
 *
 * @param count - `getCount` 解析值
 * @returns QueryBuilder 链 mock
 */
function createStatsUnassignedCountQbMock(
  count: number,
): Record<string, jest.Mock> {
  return {
    andWhere: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(count),
  };
}

/**
 * 构造提醒候选案件加载链 mock（含 join）。
 *
 * @param cases - `getMany` 返回值
 * @returns QueryBuilder 链 mock
 */
function createReminderCandidateQbMock(
  cases: Record<string, unknown>[] = [],
): Record<string, jest.Mock> {
  return {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(cases),
  };
}

/**
 * 累加统计接口中各 `caseStatus` 分桶件数。
 *
 * @param stats - 域统计载荷
 * @returns 各状态计数之和
 */
function sumCaseStatusCounts(stats: VisaDomainStatsDto): number {
  return stats.caseStatusCounts.reduce((acc, row) => acc + row.count, 0);
}

/** F1a：`findAllGlobal`、`getVisaDomainStats`、`findVisaReminders` 对同一 `dataScope` 入参复用同一 resolve 调用形状。 */
describe('F1a cohesion: list + stats + reminders share dataScope resolve args', () => {
  const cases: Array<{
    label: string;
    queryScope: VisaDataScope | undefined;
    resolveArg: VisaDataScope | undefined;
  }> = [
    { label: 'default (all)', queryScope: undefined, resolveArg: undefined },
    {
      label: 'all',
      queryScope: VisaDataScope.ALL,
      resolveArg: VisaDataScope.ALL,
    },
    {
      label: 'mine',
      queryScope: VisaDataScope.MINE,
      resolveArg: VisaDataScope.MINE,
    },
    {
      label: 'team',
      queryScope: VisaDataScope.TEAM,
      resolveArg: VisaDataScope.TEAM,
    },
  ];

  it.each(cases)(
    'aligns resolve($queryScope) across global list, stats, reminders ($label)',
    async ({ queryScope, resolveArg }) => {
      const ctx = await createTestingContext();
      const { service, visaCaseRepo, noteRepo, dataScopeResolve } = ctx;
      const reminders = ctx.module.get(VisaCaseReminderService);
      dataScopeResolve.mockClear();
      dataScopeResolve.mockResolvedValue({ mode: 'all' });
      noteRepo.manager.query.mockResolvedValue([]);

      const listQb = createQueryBuilderMock([[], 0]);
      const openQb = createStatsOpenCasesQbMock([]);
      const groupQb = createStatsGroupByQbMock([]);
      const unassQb = createStatsUnassignedCountQbMock(0);
      const remQb = createReminderCandidateQbMock([]);

      visaCaseRepo.createQueryBuilder
        .mockReturnValueOnce(listQb)
        .mockReturnValueOnce(openQb)
        .mockReturnValueOnce(groupQb)
        .mockReturnValueOnce(unassQb)
        .mockReturnValueOnce(remQb);
      visaCaseRepo.find.mockResolvedValue([] as unknown as VisaCase[]);

      const listQuery =
        queryScope === undefined
          ? { page: 1, pageSize: 20 }
          : { page: 1, pageSize: 20, dataScope: queryScope };
      const statsQuery =
        queryScope === undefined ? {} : { dataScope: queryScope };
      const remQuery =
        queryScope === undefined ? {} : { dataScope: queryScope };

      await service.findAllGlobal(listQuery, 'user-scope');
      await service.getVisaDomainStats(statsQuery, 'user-scope');
      await reminders.findVisaReminders(remQuery, 'user-scope');

      expect(dataScopeResolve).toHaveBeenCalledTimes(3);
      expect(dataScopeResolve).toHaveBeenNthCalledWith(
        1,
        'user-scope',
        resolveArg,
      );
      expect(dataScopeResolve).toHaveBeenNthCalledWith(
        2,
        'user-scope',
        resolveArg,
      );
      expect(dataScopeResolve).toHaveBeenNthCalledWith(
        3,
        'user-scope',
        resolveArg,
      );
    },
  );
});

/** F1a：收窄 scope 时仍保持 C1 列表 total 与 stats 分桶合计同构（mock 协调）。 */
describe('F1a cohesion: list total vs stats under narrowed resolved scope', () => {
  it('matches list total to sum(caseStatusCounts) when resolve returns mine', async () => {
    const ctx = await createTestingContext();
    const { service, visaCaseRepo, noteRepo, dataScopeResolve } = ctx;
    dataScopeResolve.mockResolvedValue({
      mode: 'mine',
      userId: 'user-scope',
    });
    noteRepo.manager.query.mockResolvedValue([]);

    const listQb = createQueryBuilderMock([
      [{ id: 'vc-a' }, { id: 'vc-b' }],
      2,
    ]);
    const openQb = createStatsOpenCasesQbMock([
      buildReminderCase({ id: 'vc-a', caseStatus: VisaCaseStatus.DRAFT }),
      buildReminderCase({
        id: 'vc-b',
        caseStatus: VisaCaseStatus.IN_PROGRESS,
      }),
    ]);
    const groupQb = createStatsGroupByQbMock([
      { caseStatus: VisaCaseStatus.DRAFT, count: '1' },
      { caseStatus: VisaCaseStatus.IN_PROGRESS, count: '1' },
    ]);
    visaCaseRepo.createQueryBuilder
      .mockReturnValueOnce(listQb)
      .mockReturnValueOnce(openQb)
      .mockReturnValueOnce(groupQb);
    visaCaseRepo.find.mockResolvedValue([] as unknown as VisaCase[]);

    const list = await service.findAllGlobal(
      { page: 1, pageSize: 20, dataScope: VisaDataScope.MINE },
      'user-scope',
    );
    const stats = await service.getVisaDomainStats(
      { dataScope: VisaDataScope.MINE },
      'user-scope',
    );

    expect(list.total).toBe(sumCaseStatusCounts(stats));
    expect(list.total).toBe(2);
    expect(dataScopeResolve).toHaveBeenCalledTimes(2);
  });
});

/** F1b（签证侧）：提醒列表与案件列表同源 `resolve`，便于与客户 EXISTS 口径对账。 */
describe('F1b cohesion (visa): reminders use same resolve contract as global list', () => {
  it('findVisaReminders passes query.dataScope into resolve like findAllGlobal', async () => {
    const ctx = await createTestingContext();
    const { service, visaCaseRepo, noteRepo, dataScopeResolve } = ctx;
    const reminders = ctx.module.get(VisaCaseReminderService);
    dataScopeResolve.mockResolvedValue({ mode: 'all' });
    noteRepo.manager.query.mockResolvedValue([]);

    const listQb = createQueryBuilderMock([[], 0]);
    const remQb = createReminderCandidateQbMock([]);
    visaCaseRepo.createQueryBuilder
      .mockReturnValueOnce(listQb)
      .mockReturnValueOnce(remQb);
    visaCaseRepo.find.mockResolvedValue([] as unknown as VisaCase[]);

    await service.findAllGlobal(
      { page: 1, pageSize: 20, dataScope: VisaDataScope.TEAM },
      'u1',
    );
    await reminders.findVisaReminders({ dataScope: VisaDataScope.TEAM }, 'u1');

    expect(dataScopeResolve.mock.calls).toEqual([
      ['u1', VisaDataScope.TEAM],
      ['u1', VisaDataScope.TEAM],
    ]);
  });
});
