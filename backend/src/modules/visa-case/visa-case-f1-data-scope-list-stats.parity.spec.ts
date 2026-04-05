import { VisaCaseStatus, VisaDataScope } from '../../common/constants/enums';
import type { VisaCase } from './entities/visa-case.entity';
import {
  buildReminderCase,
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
 * @param stats - 域统计载荷
 * @returns 各状态计数之和
 */
function sumCaseStatusCounts(stats: VisaDomainStatsDto): number {
  return stats.caseStatusCounts.reduce((acc, row) => acc + row.count, 0);
}

type F1aScopeRow = {
  label: string;
  dataScope: VisaDataScope;
  resolved:
    | { mode: 'all' }
    | { mode: 'mine'; userId: string }
    | {
        mode: 'team';
        currentUserId: string;
        teamAssigneeIds: string[];
      };
  useUnassignedQb: boolean;
};

const f1aScopeRows: F1aScopeRow[] = [
  {
    label: 'ALL',
    dataScope: VisaDataScope.ALL,
    resolved: { mode: 'all' },
    useUnassignedQb: true,
  },
  {
    label: 'MINE',
    dataScope: VisaDataScope.MINE,
    resolved: { mode: 'mine', userId: 'user-1' },
    useUnassignedQb: false,
  },
  {
    label: 'TEAM',
    dataScope: VisaDataScope.TEAM,
    resolved: {
      mode: 'team',
      currentUserId: 'user-1',
      teamAssigneeIds: ['user-1', 'peer-2'],
    },
    useUnassignedQb: false,
  },
];

/**
 * 断言单条 F1a scope 下列表 total 与状态计数之和一致且 `resolve` 入参一致。
 *
 * @param row - 数据范围用例行
 * @returns 异步断言完成的 Promise
 */
async function runF1aScopeListStatsParityCase(row: F1aScopeRow): Promise<void> {
  const { dataScope, resolved, useUnassignedQb } = row;
  const ctx = await createTestingContext();
  const { service, visaCaseRepo, noteRepo, dataScopeResolve } = ctx;
  dataScopeResolve.mockReset();
  dataScopeResolve.mockResolvedValue(resolved);
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
  if (useUnassignedQb) {
    const unassQb = createStatsUnassignedCountQbMock(0);
    visaCaseRepo.createQueryBuilder
      .mockReturnValueOnce(listQb)
      .mockReturnValueOnce(openQb)
      .mockReturnValueOnce(groupQb)
      .mockReturnValueOnce(unassQb);
  } else {
    visaCaseRepo.createQueryBuilder
      .mockReturnValueOnce(listQb)
      .mockReturnValueOnce(openQb)
      .mockReturnValueOnce(groupQb);
  }
  visaCaseRepo.find.mockResolvedValue([] as unknown as VisaCase[]);

  const list = await service.findAllGlobal(
    { page: 1, pageSize: 20, dataScope },
    'user-1',
  );
  const stats = await service.getVisaDomainStats({ dataScope }, 'user-1');

  expect(dataScopeResolve).toHaveBeenCalledTimes(2);
  expect(dataScopeResolve).toHaveBeenNthCalledWith(1, 'user-1', dataScope);
  expect(dataScopeResolve).toHaveBeenNthCalledWith(2, 'user-1', dataScope);
  expect(list.total).toBe(sumCaseStatusCounts(stats));
  expect(list.total).toBe(3);
}

/**
 * 断言省略 `dataScope` 时两次 `resolve(undefined)` 且 total 与计数和一致。
 *
 * @returns 异步断言完成的 Promise
 */
async function runF1aOmittedDataScopeParityCase(): Promise<void> {
  const ctx = await createTestingContext();
  const { service, visaCaseRepo, noteRepo, dataScopeResolve } = ctx;
  dataScopeResolve.mockReset();
  dataScopeResolve.mockResolvedValue({ mode: 'all' });
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

  const list = await service.findAllGlobal({ page: 1, pageSize: 20 }, 'user-1');
  const stats = await service.getVisaDomainStats({}, 'user-1');

  expect(dataScopeResolve).toHaveBeenCalledTimes(2);
  expect(dataScopeResolve).toHaveBeenNthCalledWith(1, 'user-1', undefined);
  expect(dataScopeResolve).toHaveBeenNthCalledWith(2, 'user-1', undefined);
  expect(list.total).toBe(sumCaseStatusCounts(stats));
}

/**
 * 断言 MINE 下列表与统计 QueryBuilder 均注入 `assigned_to` 条件。
 *
 * @returns 异步断言完成的 Promise
 */
async function runF1aMineScopeQueryBuilderInjectionCase(): Promise<void> {
  const ctx = await createTestingContext();
  const { service, visaCaseRepo, noteRepo, dataScopeResolve } = ctx;
  dataScopeResolve.mockReset();
  dataScopeResolve.mockResolvedValue({ mode: 'mine', userId: 'user-1' });
  noteRepo.manager.query.mockResolvedValue([]);

  const listQb = createQueryBuilderMock([[], 0]);
  const openQb = createStatsOpenCasesQbMock([]);
  const groupQb = createStatsGroupByQbMock([]);
  visaCaseRepo.createQueryBuilder
    .mockReturnValueOnce(listQb)
    .mockReturnValueOnce(openQb)
    .mockReturnValueOnce(groupQb);
  visaCaseRepo.find.mockResolvedValue([] as unknown as VisaCase[]);

  await service.findAllGlobal(
    { page: 1, pageSize: 20, dataScope: VisaDataScope.MINE },
    'user-1',
  );
  await service.getVisaDomainStats({ dataScope: VisaDataScope.MINE }, 'user-1');

  expect(listQb.andWhere).toHaveBeenCalledWith(
    'vc.assignedTo = :gvcScopeMine',
    { gvcScopeMine: 'user-1' },
  );
  expect(openQb.andWhere).toHaveBeenCalledWith(
    'vc.assignedTo = :statsScopeMine',
    { statsScopeMine: 'user-1' },
  );
  expect(groupQb.andWhere).toHaveBeenCalledWith(
    'vc.assignedTo = :statsStScopeMine',
    { statsStScopeMine: 'user-1' },
  );
}

/**
 * 断言 TEAM 下列表与统计 QueryBuilder 使用同一组员 ID 列表参数。
 *
 * @returns 异步断言完成的 Promise
 */
async function runF1aTeamScopeQueryBuilderInjectionCase(): Promise<void> {
  const ctx = await createTestingContext();
  const { service, visaCaseRepo, noteRepo, dataScopeResolve } = ctx;
  const teamIds = ['user-1', 'peer-2'];
  dataScopeResolve.mockReset();
  dataScopeResolve.mockResolvedValue({
    mode: 'team',
    currentUserId: 'user-1',
    teamAssigneeIds: teamIds,
  });
  noteRepo.manager.query.mockResolvedValue([]);

  const listQb = createQueryBuilderMock([[], 0]);
  const openQb = createStatsOpenCasesQbMock([]);
  const groupQb = createStatsGroupByQbMock([]);
  visaCaseRepo.createQueryBuilder
    .mockReturnValueOnce(listQb)
    .mockReturnValueOnce(openQb)
    .mockReturnValueOnce(groupQb);
  visaCaseRepo.find.mockResolvedValue([] as unknown as VisaCase[]);

  await service.findAllGlobal(
    { page: 1, pageSize: 20, dataScope: VisaDataScope.TEAM },
    'user-1',
  );
  await service.getVisaDomainStats({ dataScope: VisaDataScope.TEAM }, 'user-1');

  expect(listQb.setParameter).toHaveBeenCalledWith('gvcScopeTeam', teamIds);
  expect(openQb.setParameter).toHaveBeenCalledWith('statsScopeTeam', teamIds);
  expect(groupQb.setParameter).toHaveBeenCalledWith(
    'statsStScopeTeam',
    teamIds,
  );
}

function registerF1aResolveParitySuite(): void {
  describe('resolve parity and totals', () => {
    it.each(f1aScopeRows)(
      '$label: resolve called twice with same dataScope; total matches sum(caseStatusCounts)',
      (row) => runF1aScopeListStatsParityCase(row),
    );

    it('omitted dataScope: resolve twice with undefined (all semantics)', () =>
      runF1aOmittedDataScopeParityCase());
  });
}

function registerF1aQueryBuilderScopeSuite(): void {
  describe('query builder scope injection', () => {
    it('injects mine assigned_to on list and both stats query builders', () =>
      runF1aMineScopeQueryBuilderInjectionCase());

    it('injects same team assignee id list on list and both stats builders', () =>
      runF1aTeamScopeQueryBuilderInjectionCase());
  });
}

/**
 * Phase F1a：登记册 `findAllGlobal` 与 `getVisaDomainStats` 在 mine / team / all（及未传 query 的宽口径）
 * 下共用 `VisaCaseDataScopeService.resolve` 且列表 total 与状态计数之和一致。
 *
 * @see docs/27_P2-S2g_签证域数据范围发布说明.md §1、§2、§5（F1a 行）
 */
describe('F1a: global list vs stats under visa dataScope', () => {
  registerF1aResolveParitySuite();
  registerF1aQueryBuilderScopeSuite();
});
