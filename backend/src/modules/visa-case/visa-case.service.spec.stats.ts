import { VisaCaseStatus } from '../../common/constants/enums';
import type { ContextAccessor } from './visa-case.service.spec-helpers';
import { addDays, buildReminderCase } from './visa-case.service.spec-helpers';

/**
 * 构造仅用于统计开放案件查询链的 QueryBuilder 模拟。
 *
 * @param cases - `getMany` 解析结果
 * @returns 含 `where` / `andWhere` / `getMany` 的链式 mock
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
 * 构造 `GROUP BY case_status` 统计链的 QueryBuilder 模拟。
 *
 * @param rows - `getRawMany` 解析结果
 * @returns 含 `select` / `addSelect` / `groupBy` / `getRawMany` 的链式 mock
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
 * 构造 `countUnassignedWithinListFilters` 使用的 QueryBuilder 模拟（与列表同构筛选 + `assigned_to IS NULL`）。
 *
 * @param count - `getCount` 返回值
 * @returns 含 `andWhere` / `setParameter` / `getCount` 的链式 mock
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

function registerGetVisaDomainStatsCoreTestsPart1(
  getContext: ContextAccessor,
): void {
  it('should aggregate reminder buckets using same priority as reminders', async () => {
    const { service, visaCaseRepo, noteRepo } = getContext();
    const supplementCase = buildReminderCase({
      id: 'vc-sup',
      caseStatus: VisaCaseStatus.SUPPLEMENT,
    });
    const openQb = createStatsOpenCasesQbMock([supplementCase]);
    const groupQb = createStatsGroupByQbMock([
      { caseStatus: VisaCaseStatus.SUPPLEMENT, count: '1' },
    ]);
    const unassignedQb = createStatsUnassignedCountQbMock(0);
    visaCaseRepo.createQueryBuilder
      .mockReturnValueOnce(openQb)
      .mockReturnValueOnce(groupQb)
      .mockReturnValueOnce(unassignedQb);
    noteRepo.manager.query.mockResolvedValue([]);
    visaCaseRepo.count.mockResolvedValue(0);

    const result = await service.getVisaDomainStats({}, 'user-1');

    expect(result.reminderBuckets.supplement).toBe(1);
    expect(result.reminderBuckets.todayFollowUp).toBe(0);
    expect(result.reminderBuckets.expiring7Days).toBe(0);
    expect(result.reminderBuckets.expiring2Months).toBe(0);
    expect(result.reminderBuckets.noBucket).toBe(0);
    expect(result.supplementRelatedCount).toBe(1);
    expect(
      result.reminderBuckets.supplement +
        result.reminderBuckets.todayFollowUp +
        result.reminderBuckets.expiring7Days +
        result.reminderBuckets.expiring2Months +
        result.reminderBuckets.noBucket,
    ).toBe(1);
  });

  it('should count expiringWithin7DaysWindow for open cases with expire within 7 days', async () => {
    const { service, visaCaseRepo, noteRepo } = getContext();
    const nearExpiry = buildReminderCase({
      id: 'vc-7',
      caseStatus: VisaCaseStatus.IN_PROGRESS,
      expireDate: addDays(new Date(), 4),
    });
    const openQb = createStatsOpenCasesQbMock([nearExpiry]);
    const groupQb = createStatsGroupByQbMock([
      { caseStatus: VisaCaseStatus.IN_PROGRESS, count: '1' },
    ]);
    const unassignedQb = createStatsUnassignedCountQbMock(0);
    visaCaseRepo.createQueryBuilder
      .mockReturnValueOnce(openQb)
      .mockReturnValueOnce(groupQb)
      .mockReturnValueOnce(unassignedQb);
    noteRepo.manager.query.mockResolvedValue([]);
    visaCaseRepo.count.mockResolvedValue(1);

    const result = await service.getVisaDomainStats({}, 'user-1');

    expect(result.expiringWithin7DaysWindow).toBe(1);
    expect(result.reminderBuckets.expiring7Days).toBe(1);
  });
}

function registerGetVisaDomainStatsCoreTestsPart2(
  getContext: ContextAccessor,
): void {
  it('should classify open case with only far expiry as noBucket', async () => {
    const { service, visaCaseRepo, noteRepo } = getContext();
    const calm = buildReminderCase({
      id: 'vc-calm',
      caseStatus: VisaCaseStatus.IN_PROGRESS,
      expireDate: addDays(new Date(), 120),
      nextFollowUpAt: null,
    });
    const openQb = createStatsOpenCasesQbMock([calm]);
    const groupQb = createStatsGroupByQbMock([
      { caseStatus: VisaCaseStatus.IN_PROGRESS, count: '1' },
    ]);
    const unassignedQb = createStatsUnassignedCountQbMock(0);
    visaCaseRepo.createQueryBuilder
      .mockReturnValueOnce(openQb)
      .mockReturnValueOnce(groupQb)
      .mockReturnValueOnce(unassignedQb);
    noteRepo.manager.query.mockResolvedValue([]);
    visaCaseRepo.count.mockResolvedValue(1);

    const result = await service.getVisaDomainStats({}, 'user-1');

    expect(result.reminderBuckets.noBucket).toBe(1);
    expect(result.expiringWithin7DaysWindow).toBe(0);
  });
}

function registerGetVisaDomainStatsCoreTests(
  getContext: ContextAccessor,
): void {
  registerGetVisaDomainStatsCoreTestsPart1(getContext);
  registerGetVisaDomainStatsCoreTestsPart2(getContext);
}

function registerGetVisaDomainStatsAlignmentTests(
  getContext: ContextAccessor,
): void {
  it('should align deduped bucket counts with findVisaReminders summary for same open set', async () => {
    const { service, visaCaseRepo, noteRepo } = getContext();
    const c1 = buildReminderCase({
      id: 'a',
      caseStatus: VisaCaseStatus.SUPPLEMENT,
    });
    const c2 = buildReminderCase({
      id: 'b',
      caseStatus: VisaCaseStatus.IN_PROGRESS,
      nextFollowUpAt: new Date(),
    });
    const listQb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([c1, c2]),
    };
    const openQb = createStatsOpenCasesQbMock([c1, c2]);
    const groupQb = createStatsGroupByQbMock([
      { caseStatus: VisaCaseStatus.SUPPLEMENT, count: '1' },
      { caseStatus: VisaCaseStatus.IN_PROGRESS, count: '1' },
    ]);
    noteRepo.manager.query.mockResolvedValue([]);

    const unassignedQb = createStatsUnassignedCountQbMock(0);
    visaCaseRepo.createQueryBuilder
      .mockReturnValueOnce(listQb)
      .mockReturnValueOnce(openQb)
      .mockReturnValueOnce(groupQb)
      .mockReturnValueOnce(unassignedQb);
    visaCaseRepo.count.mockResolvedValue(0);

    const reminders = await service.findVisaReminders({}, 'user-1');
    const stats = await service.getVisaDomainStats({}, 'user-1');

    expect(stats.reminderBuckets.supplement).toBe(reminders.summary.supplement);
    expect(stats.reminderBuckets.todayFollowUp).toBe(
      reminders.summary.todayFollowUp,
    );
    expect(stats.reminderBuckets.expiring7Days).toBe(
      reminders.summary.expiring7Days,
    );
    expect(stats.reminderBuckets.expiring2Months).toBe(
      reminders.summary.expiring2Months,
    );
  });
}

function registerGetVisaDomainStatsFilterTests(
  getContext: ContextAccessor,
): void {
  it('should set unassignedCount to 0 when assignedTo filter is present', async () => {
    const { service, visaCaseRepo, noteRepo } = getContext();
    const openQb = createStatsOpenCasesQbMock([]);
    const groupQb = createStatsGroupByQbMock([]);
    visaCaseRepo.createQueryBuilder
      .mockReturnValueOnce(openQb)
      .mockReturnValueOnce(groupQb);
    noteRepo.manager.query.mockResolvedValue([]);

    const result = await service.getVisaDomainStats(
      {
        assignedTo: '11111111-1111-4111-8111-111111111111',
      },
      'user-1',
    );

    expect(result.unassignedCount).toBe(0);
    expect(visaCaseRepo.count).not.toHaveBeenCalled();
  });

  it('should apply assignedTo filter to open-case and status aggregations', async () => {
    const { service, visaCaseRepo, noteRepo } = getContext();
    const uid = '22222222-2222-4222-8222-222222222222';
    const openQb = createStatsOpenCasesQbMock([]);
    const groupQb = createStatsGroupByQbMock([]);
    visaCaseRepo.createQueryBuilder
      .mockReturnValueOnce(openQb)
      .mockReturnValueOnce(groupQb);
    noteRepo.manager.query.mockResolvedValue([]);

    await service.getVisaDomainStats({ assignedTo: uid }, 'user-1');

    expect(openQb.andWhere).toHaveBeenCalled();
    expect(groupQb.andWhere).toHaveBeenCalled();
  });

  it('should count supplementRelated from latest log when status is not SUPPLEMENT', async () => {
    const { service, visaCaseRepo, noteRepo } = getContext();
    const vcId = 'vc-log-only';
    const row = buildReminderCase({
      id: vcId,
      caseStatus: VisaCaseStatus.IN_PROGRESS,
      expireDate: addDays(new Date(), 200),
    });
    const openQb = createStatsOpenCasesQbMock([row]);
    const groupQb = createStatsGroupByQbMock([
      { caseStatus: VisaCaseStatus.IN_PROGRESS, count: '1' },
    ]);
    const unassignedQb = createStatsUnassignedCountQbMock(0);
    visaCaseRepo.createQueryBuilder
      .mockReturnValueOnce(openQb)
      .mockReturnValueOnce(groupQb)
      .mockReturnValueOnce(unassignedQb);
    noteRepo.manager.query.mockResolvedValue([{ visa_case_id: vcId }]);
    visaCaseRepo.count.mockResolvedValue(0);

    const result = await service.getVisaDomainStats({}, 'user-1');

    expect(result.supplementRelatedCount).toBe(1);
    expect(result.reminderBuckets.supplement).toBe(1);
  });
}

/**
 * 注册 `getVisaDomainStats` 单测，覆盖桶规则、与提醒摘要对齐及负责人筛选。
 *
 * @param getContext - 取得 VisaCaseService 与仓储 mock 的访问器
 */
export function registerGetVisaDomainStatsTests(
  getContext: ContextAccessor,
): void {
  describe('getVisaDomainStats', () => {
    registerGetVisaDomainStatsCoreTests(getContext);
    registerGetVisaDomainStatsAlignmentTests(getContext);
    registerGetVisaDomainStatsFilterTests(getContext);
  });
}
