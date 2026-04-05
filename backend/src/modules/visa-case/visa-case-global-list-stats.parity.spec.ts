import { VisaCaseStatus, VisaReminderType } from '../../common/constants/enums';
import type { VisaCase } from './entities/visa-case.entity';
import {
  buildReminderCase,
  buildVisaCaseRecord,
  createQueryBuilderMock,
  createTestingContext,
} from './visa-case.service.spec-helpers';
import type { VisaDomainStatsDto } from './visa-case.types';

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
 * 构造未指派计数链 mock（`getVisaDomainStats` 在宽范围下追加的 `getCount` 查询）。
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
 * 累加统计接口中各 `caseStatus` 分桶件数，应与无状态筛选的全局列表 `total` 一致。
 *
 * @param stats - 域统计载荷
 * @returns 各状态计数之和
 */
function sumCaseStatusCounts(stats: VisaDomainStatsDto): number {
  return stats.caseStatusCounts.reduce((acc, row) => acc + row.count, 0);
}

/** Phase C1：全局列表 `findAllGlobal` 与 `getVisaDomainStats` 在可比筛选下计数同构（Jest 协调 mock）。 */
describe('C1 parity: global list total vs sum(caseStatusCounts) baseline', () => {
  it('matches list total to sum(caseStatusCounts) under baseline filters', async () => {
    const ctx = await createTestingContext();
    const { service, visaCaseRepo, noteRepo } = ctx;
    noteRepo.manager.query.mockResolvedValue([]);

    const listQb = createQueryBuilderMock([
      [{ id: 'vc-draft' }, { id: 'vc-prog' }, { id: 'vc-done' }],
      3,
    ]);
    const openQb = createStatsOpenCasesQbMock([
      buildReminderCase({
        id: 'vc-draft',
        caseStatus: VisaCaseStatus.DRAFT,
      }),
      buildReminderCase({
        id: 'vc-prog',
        caseStatus: VisaCaseStatus.IN_PROGRESS,
      }),
    ]);
    const groupQb = createStatsGroupByQbMock([
      { caseStatus: VisaCaseStatus.DRAFT, count: '1' },
      { caseStatus: VisaCaseStatus.IN_PROGRESS, count: '1' },
      { caseStatus: VisaCaseStatus.COMPLETED, count: '1' },
    ]);
    const unassQb = createStatsUnassignedCountQbMock(0);
    visaCaseRepo.createQueryBuilder
      .mockReturnValueOnce(listQb)
      .mockReturnValueOnce(openQb)
      .mockReturnValueOnce(groupQb)
      .mockReturnValueOnce(unassQb);
    visaCaseRepo.find.mockResolvedValue([] as unknown as VisaCase[]);

    const list = await service.findAllGlobal(
      { page: 1, pageSize: 20 },
      'user-1',
    );
    const stats = await service.getVisaDomainStats({}, 'user-1');

    expect(list.total).toBe(sumCaseStatusCounts(stats));
    expect(list.total).toBe(3);
  });
});

describe('C1 parity: global list vs stats under assignee filter', () => {
  it('matches list total to stats when scoped to the same assignee', async () => {
    const ctx = await createTestingContext();
    const { service, visaCaseRepo, noteRepo } = ctx;
    noteRepo.manager.query.mockResolvedValue([]);
    const uid = '33333333-3333-4333-8333-333333333333';

    const listQb = createQueryBuilderMock([
      [{ id: 'vc-a' }, { id: 'vc-b' }],
      2,
    ]);
    const openQb = createStatsOpenCasesQbMock([
      buildReminderCase({ id: 'vc-a', caseStatus: VisaCaseStatus.SUBMITTED }),
      buildReminderCase({
        id: 'vc-b',
        caseStatus: VisaCaseStatus.IN_PROGRESS,
      }),
    ]);
    const groupQb = createStatsGroupByQbMock([
      { caseStatus: VisaCaseStatus.SUBMITTED, count: '1' },
      { caseStatus: VisaCaseStatus.IN_PROGRESS, count: '1' },
    ]);
    visaCaseRepo.createQueryBuilder
      .mockReturnValueOnce(listQb)
      .mockReturnValueOnce(openQb)
      .mockReturnValueOnce(groupQb);
    visaCaseRepo.count.mockResolvedValue(0);
    visaCaseRepo.find.mockResolvedValue([] as unknown as VisaCase[]);

    const list = await service.findAllGlobal(
      { page: 1, pageSize: 20, assignedToIds: [uid] },
      'user-1',
    );
    const stats = await service.getVisaDomainStats(
      { assignedToIds: [uid] },
      'user-1',
    );

    expect(list.total).toBe(sumCaseStatusCounts(stats));
    expect(list.total).toBe(2);
    expect(stats.unassignedCount).toBe(0);
  });
});

describe('C1 parity: global list vs stats.caseStatusCounts slice', () => {
  it('matches list total to single caseStatus slice from stats', async () => {
    const ctx = await createTestingContext();
    const { service, visaCaseRepo, noteRepo } = ctx;
    noteRepo.manager.query.mockResolvedValue([]);

    const listQb = createQueryBuilderMock([[{ id: 'vc-prog-only' }], 1]);
    const openQb = createStatsOpenCasesQbMock([
      buildReminderCase({
        id: 'vc-prog-only',
        caseStatus: VisaCaseStatus.IN_PROGRESS,
      }),
      buildReminderCase({
        id: 'vc-draft-other',
        caseStatus: VisaCaseStatus.DRAFT,
      }),
    ]);
    const groupQb = createStatsGroupByQbMock([
      { caseStatus: VisaCaseStatus.IN_PROGRESS, count: '1' },
      { caseStatus: VisaCaseStatus.DRAFT, count: '2' },
    ]);
    const unassQb = createStatsUnassignedCountQbMock(0);
    visaCaseRepo.createQueryBuilder
      .mockReturnValueOnce(listQb)
      .mockReturnValueOnce(openQb)
      .mockReturnValueOnce(groupQb)
      .mockReturnValueOnce(unassQb);
    visaCaseRepo.find.mockResolvedValue([] as unknown as VisaCase[]);

    const list = await service.findAllGlobal(
      { page: 1, pageSize: 20, caseStatuses: [VisaCaseStatus.IN_PROGRESS] },
      'user-1',
    );
    const stats = await service.getVisaDomainStats(
      {
        caseStatuses: [VisaCaseStatus.IN_PROGRESS],
      },
      'user-1',
    );

    const inProgressCount =
      stats.caseStatusCounts.find(
        (c) => c.caseStatus === VisaCaseStatus.IN_PROGRESS,
      )?.count ?? 0;
    expect(list.total).toBe(inProgressCount);
    expect(list.total).toBe(1);
  });
});

describe('C1 parity: global list reminderBucket vs stats.reminderBuckets', () => {
  it('matches list total to stats.reminderBuckets.supplement', async () => {
    const ctx = await createTestingContext();
    const { service, visaCaseRepo, noteRepo } = ctx;
    const vcLogOnly = 'vc-log-supplement';
    noteRepo.manager.query.mockResolvedValue([{ visa_case_id: vcLogOnly }]);

    const supCase = buildReminderCase({
      id: 'vc-status-sup',
      caseStatus: VisaCaseStatus.SUPPLEMENT,
    });
    const logCase = buildReminderCase({
      id: vcLogOnly,
      caseStatus: VisaCaseStatus.IN_PROGRESS,
      nextFollowUpAt: null,
      expireDate: null,
    });

    const listQb = createQueryBuilderMock([
      [{ id: supCase.id }, { id: logCase.id }],
      2,
    ]);
    const openQb = createStatsOpenCasesQbMock([supCase, logCase]);
    const groupQb = createStatsGroupByQbMock([
      { caseStatus: VisaCaseStatus.SUPPLEMENT, count: '1' },
      { caseStatus: VisaCaseStatus.IN_PROGRESS, count: '1' },
    ]);
    const unassQb = createStatsUnassignedCountQbMock(0);
    visaCaseRepo.createQueryBuilder
      .mockReturnValueOnce(listQb)
      .mockReturnValueOnce(openQb)
      .mockReturnValueOnce(groupQb)
      .mockReturnValueOnce(unassQb);
    visaCaseRepo.find.mockResolvedValue([
      buildVisaCaseRecord({ id: supCase.id }),
      buildVisaCaseRecord({ id: logCase.id }),
    ] as unknown as VisaCase[]);

    const list = await service.findAllGlobal(
      {
        page: 1,
        pageSize: 20,
        reminderBucket: VisaReminderType.SUPPLEMENT,
      },
      'user-1',
    );
    const stats = await service.getVisaDomainStats(
      {
        reminderBucket: VisaReminderType.SUPPLEMENT,
      },
      'user-1',
    );

    expect(list.total).toBe(stats.reminderBuckets.supplement);
    expect(list.total).toBe(2);
  });
});
