import { VisaCaseStatus, VisaDataScope } from '../../common/constants/enums';
import {
  buildReminderCase,
  createQueryBuilderMock,
  createTestingContext,
} from './visa-case.service.spec-helpers';

/**
 * 构造 `getVisaDomainStats` 开放案件与分组统计的 QueryBuilder mock 序列。
 *
 * @param openCases - 开放案件 `getMany` 结果
 * @param groupRows - `GROUP BY case_status` 原始行
 * @returns 依次用于 openQb、groupQb 的 mock
 */
function createStatsQueryChain(
  openCases: Record<string, unknown>[],
  groupRows: Record<string, string>[],
): [Record<string, jest.Mock>, Record<string, jest.Mock>] {
  const openQb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(openCases),
  };
  const groupQb = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(groupRows),
  };
  return [openQb, groupQb];
}

const uid = 'user-f1b-1';

/**
 * MINE：`findVisaReminders` 与 `getVisaDomainStats` 共用 `resolve` 且补件摘要一致。
 *
 * @returns 异步断言完成的 Promise
 */
async function runF1bMineRemindersStatsParity(): Promise<void> {
  const ctx = await createTestingContext();
  const { service, visaCaseRepo, noteRepo, dataScopeResolve } = ctx;
  dataScopeResolve.mockResolvedValue({ mode: 'mine', userId: uid });
  noteRepo.manager.query.mockResolvedValue([]);

  const sup = buildReminderCase({
    id: 'vc-f1b-m',
    caseStatus: VisaCaseStatus.SUPPLEMENT,
  });
  const reminderQb = createQueryBuilderMock([[sup], 1]);
  const [openQb, groupQb] = createStatsQueryChain(
    [sup],
    [{ caseStatus: VisaCaseStatus.SUPPLEMENT, count: '1' }],
  );

  visaCaseRepo.createQueryBuilder
    .mockReturnValueOnce(reminderQb)
    .mockReturnValueOnce(openQb)
    .mockReturnValueOnce(groupQb);
  visaCaseRepo.count.mockResolvedValue(0);

  const reminders = await service.findVisaReminders(
    { dataScope: VisaDataScope.MINE },
    uid,
  );
  const stats = await service.getVisaDomainStats(
    { dataScope: VisaDataScope.MINE },
    uid,
  );

  expect(dataScopeResolve).toHaveBeenCalledTimes(2);
  expect(dataScopeResolve).toHaveBeenNthCalledWith(1, uid, VisaDataScope.MINE);
  expect(dataScopeResolve).toHaveBeenNthCalledWith(2, uid, VisaDataScope.MINE);
  expect(reminders.summary.supplement).toBe(stats.reminderBuckets.supplement);
  expect(reminders.summary.supplement).toBe(1);
}

/**
 * TEAM：两接口 `resolve` 入参一致且补件计数一致。
 *
 * @returns 异步断言完成的 Promise
 */
async function runF1bTeamRemindersStatsParity(): Promise<void> {
  const ctx = await createTestingContext();
  const { service, visaCaseRepo, noteRepo, dataScopeResolve } = ctx;
  dataScopeResolve.mockResolvedValue({
    mode: 'team',
    currentUserId: uid,
    teamAssigneeIds: [uid, 'colleague-2'],
  });
  noteRepo.manager.query.mockResolvedValue([]);

  const sup = buildReminderCase({
    id: 'vc-f1b-t',
    caseStatus: VisaCaseStatus.SUPPLEMENT,
  });
  const reminderQb = createQueryBuilderMock([[sup], 1]);
  const [openQb, groupQb] = createStatsQueryChain(
    [sup],
    [{ caseStatus: VisaCaseStatus.SUPPLEMENT, count: '1' }],
  );

  visaCaseRepo.createQueryBuilder
    .mockReturnValueOnce(reminderQb)
    .mockReturnValueOnce(openQb)
    .mockReturnValueOnce(groupQb);
  visaCaseRepo.count.mockResolvedValue(0);

  const reminders = await service.findVisaReminders(
    { dataScope: VisaDataScope.TEAM },
    uid,
  );
  const stats = await service.getVisaDomainStats(
    { dataScope: VisaDataScope.TEAM },
    uid,
  );

  expect(dataScopeResolve).toHaveBeenCalledTimes(2);
  expect(dataScopeResolve).toHaveBeenNthCalledWith(1, uid, VisaDataScope.TEAM);
  expect(dataScopeResolve).toHaveBeenNthCalledWith(2, uid, VisaDataScope.TEAM);
  expect(reminders.summary.supplement).toBe(stats.reminderBuckets.supplement);
}

/**
 * ALL：两接口均以 ALL 解析且各调用一次 `resolve`。
 *
 * @returns 异步断言完成的 Promise
 */
async function runF1bAllRemindersStatsResolveParity(): Promise<void> {
  const ctx = await createTestingContext();
  const { service, visaCaseRepo, noteRepo, dataScopeResolve } = ctx;
  dataScopeResolve.mockResolvedValue({ mode: 'all' });
  noteRepo.manager.query.mockResolvedValue([]);

  const sup = buildReminderCase({
    id: 'vc-f1b-a',
    caseStatus: VisaCaseStatus.SUPPLEMENT,
  });
  const reminderQb = createQueryBuilderMock([[sup], 1]);
  const [openQb, groupQb] = createStatsQueryChain(
    [sup],
    [{ caseStatus: VisaCaseStatus.SUPPLEMENT, count: '1' }],
  );
  const unassQb = {
    andWhere: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(0),
  };

  visaCaseRepo.createQueryBuilder
    .mockReturnValueOnce(reminderQb)
    .mockReturnValueOnce(openQb)
    .mockReturnValueOnce(groupQb)
    .mockReturnValueOnce(unassQb);

  await service.findVisaReminders({ dataScope: VisaDataScope.ALL }, uid);
  await service.getVisaDomainStats({ dataScope: VisaDataScope.ALL }, uid);

  expect(dataScopeResolve).toHaveBeenCalledTimes(2);
  expect(dataScopeResolve).toHaveBeenNthCalledWith(1, uid, VisaDataScope.ALL);
  expect(dataScopeResolve).toHaveBeenNthCalledWith(2, uid, VisaDataScope.ALL);
}

/**
 * Phase F1b：提醒列表聚合与域统计在相同 `dataScope` 下共用 `resolve` 入参；
 * 在 mock 返回**同一补件候选集**时，`summary.supplement` 与 `stats.reminderBuckets.supplement` 一致。
 *
 * @see docs/27_P2-S2g_签证域数据范围发布说明.md §1
 */
describe('F1b: reminders vs stats under dataScope (shared resolve + supplement parity)', () => {
  it('mine: findVisaReminders and getVisaDomainStats both resolve with MINE', () =>
    runF1bMineRemindersStatsParity());

  it('team: findVisaReminders and getVisaDomainStats both resolve with TEAM', () =>
    runF1bTeamRemindersStatsParity());

  it('all: findVisaReminders and getVisaDomainStats both resolve with ALL', () =>
    runF1bAllRemindersStatsResolveParity());
});
