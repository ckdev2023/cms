import { VisaCaseStatus, VisaReminderType } from '../../common/constants/enums';
import type { ContextAccessor } from './visa-case.service.spec-helpers';
import {
  addDays,
  buildReminderCase,
  createQueryBuilderMock,
} from './visa-case.service.spec-helpers';

export function registerFindVisaRemindersTests(
  getContext: ContextAccessor,
): void {
  describe('findVisaReminders', () => {
    registerFindVisaRemindersBucketCases(getContext);
    registerFindVisaRemindersExpiryCases(getContext);
    registerFindVisaRemindersOrderingCases(getContext);
    registerFindVisaRemindersPagingCases(getContext);
  });
}

function registerFindVisaRemindersBucketCases(
  getContext: ContextAccessor,
): void {
  it('should assign SUPPLEMENT bucket for cases with SUPPLEMENT status', async () => {
    const { service, visaCaseRepo, noteRepo } = getContext();
    const supplementCase = buildReminderCase({
      id: 'vc-sup',
      caseStatus: VisaCaseStatus.SUPPLEMENT,
    });
    const qbMock = createQueryBuilderMock([[supplementCase], 1]);
    visaCaseRepo.createQueryBuilder.mockReturnValue(qbMock);
    noteRepo.manager.query.mockResolvedValue([]);

    const result = await service.findVisaReminders({}, 'user-1');

    expect(result.items).toHaveLength(1);
    expect(result.items[0].reminderType).toBe(VisaReminderType.SUPPLEMENT);
  });

  it('should assign SUPPLEMENT bucket for cases with supplement log', async () => {
    const { service, visaCaseRepo, noteRepo } = getContext();
    const normalCase = buildReminderCase({
      id: 'vc-log-sup',
      caseStatus: VisaCaseStatus.IN_PROGRESS,
      expireDate: addDays(new Date(), 30),
    });
    const qbMock = createQueryBuilderMock([[normalCase], 1]);
    visaCaseRepo.createQueryBuilder.mockReturnValue(qbMock);
    noteRepo.manager.query.mockResolvedValue([{ visa_case_id: 'vc-log-sup' }]);

    const result = await service.findVisaReminders({}, 'user-1');

    expect(result.items).toHaveLength(1);
    expect(result.items[0].reminderType).toBe(VisaReminderType.SUPPLEMENT);
  });

  it('should assign TODAY_FOLLOW_UP bucket when nextFollowUpAt is today', async () => {
    const { service, visaCaseRepo, noteRepo } = getContext();
    const followUpCase = buildReminderCase({
      id: 'vc-fu',
      caseStatus: VisaCaseStatus.IN_PROGRESS,
      nextFollowUpAt: new Date(),
    });
    const qbMock = createQueryBuilderMock([[followUpCase], 1]);
    visaCaseRepo.createQueryBuilder.mockReturnValue(qbMock);
    noteRepo.manager.query.mockResolvedValue([]);

    const result = await service.findVisaReminders({}, 'user-1');

    expect(result.items).toHaveLength(1);
    expect(result.items[0].reminderType).toBe(VisaReminderType.TODAY_FOLLOW_UP);
  });
}

function registerFindVisaRemindersExpiryCases(
  getContext: ContextAccessor,
): void {
  it('should assign EXPIRING_7_DAYS bucket for cases expiring within 7 days', async () => {
    const { service, visaCaseRepo, noteRepo } = getContext();
    const expiringCase = buildReminderCase({
      id: 'vc-7d',
      caseStatus: VisaCaseStatus.IN_PROGRESS,
      expireDate: addDays(new Date(), 3),
    });
    const qbMock = createQueryBuilderMock([[expiringCase], 1]);
    visaCaseRepo.createQueryBuilder.mockReturnValue(qbMock);
    noteRepo.manager.query.mockResolvedValue([]);

    const result = await service.findVisaReminders({}, 'user-1');

    expect(result.items).toHaveLength(1);
    expect(result.items[0].reminderType).toBe(VisaReminderType.EXPIRING_7_DAYS);
  });

  it('should assign EXPIRING_7_DAYS bucket for already expired cases with EXPIRED alertLevel', async () => {
    const { service, visaCaseRepo, noteRepo } = getContext();
    const expiredCase = buildReminderCase({
      id: 'vc-exp',
      caseStatus: VisaCaseStatus.IN_PROGRESS,
      expireDate: addDays(new Date(), -5),
    });
    const qbMock = createQueryBuilderMock([[expiredCase], 1]);
    visaCaseRepo.createQueryBuilder.mockReturnValue(qbMock);
    noteRepo.manager.query.mockResolvedValue([]);

    const result = await service.findVisaReminders({}, 'user-1');

    expect(result.items).toHaveLength(1);
    expect(result.items[0].reminderType).toBe(VisaReminderType.EXPIRING_7_DAYS);
    expect(result.items[0].daysLeft).toBeLessThan(0);
  });

  it('should assign EXPIRING_2_MONTHS bucket for cases expiring in 8-60 days', async () => {
    const { service, visaCaseRepo, noteRepo } = getContext();
    const twoMonthCase = buildReminderCase({
      id: 'vc-2m',
      caseStatus: VisaCaseStatus.IN_PROGRESS,
      expireDate: addDays(new Date(), 45),
    });
    const qbMock = createQueryBuilderMock([[twoMonthCase], 1]);
    visaCaseRepo.createQueryBuilder.mockReturnValue(qbMock);
    noteRepo.manager.query.mockResolvedValue([]);

    const result = await service.findVisaReminders({}, 'user-1');

    expect(result.items).toHaveLength(1);
    expect(result.items[0].reminderType).toBe(
      VisaReminderType.EXPIRING_2_MONTHS,
    );
  });

  it('should deduplicate: SUPPLEMENT takes priority over EXPIRING_7_DAYS', async () => {
    const { service, visaCaseRepo, noteRepo } = getContext();
    const multiCase = buildReminderCase({
      id: 'vc-multi',
      caseStatus: VisaCaseStatus.SUPPLEMENT,
      expireDate: addDays(new Date(), 3),
    });
    const qbMock = createQueryBuilderMock([[multiCase], 1]);
    visaCaseRepo.createQueryBuilder.mockReturnValue(qbMock);
    noteRepo.manager.query.mockResolvedValue([]);

    const result = await service.findVisaReminders({}, 'user-1');

    expect(result.items).toHaveLength(1);
    expect(result.items[0].reminderType).toBe(VisaReminderType.SUPPLEMENT);
  });
}

function registerFindVisaRemindersOrderingCases(
  getContext: ContextAccessor,
): void {
  it('should sort by bucket priority then daysLeft ascending', async () => {
    const { service, visaCaseRepo, noteRepo } = getContext();
    const cases = [
      buildReminderCase({
        id: 'vc-2m',
        caseStatus: VisaCaseStatus.IN_PROGRESS,
        expireDate: addDays(new Date(), 30),
      }),
      buildReminderCase({
        id: 'vc-sup',
        caseStatus: VisaCaseStatus.SUPPLEMENT,
      }),
      buildReminderCase({
        id: 'vc-7d',
        caseStatus: VisaCaseStatus.IN_PROGRESS,
        expireDate: addDays(new Date(), 5),
      }),
    ];
    const qbMock = createQueryBuilderMock([cases, 3]);
    visaCaseRepo.createQueryBuilder.mockReturnValue(qbMock);
    noteRepo.manager.query.mockResolvedValue([]);

    const result = await service.findVisaReminders({}, 'user-1');

    expect(result.items.map((i) => i.id)).toEqual(['vc-sup', 'vc-7d', 'vc-2m']);
  });

  it('should filter items by reminderType but keep full summary counts', async () => {
    const { service, visaCaseRepo, noteRepo } = getContext();
    const cases = [
      buildReminderCase({
        id: 'vc-sup',
        caseStatus: VisaCaseStatus.SUPPLEMENT,
      }),
      buildReminderCase({
        id: 'vc-7d',
        caseStatus: VisaCaseStatus.IN_PROGRESS,
        expireDate: addDays(new Date(), 3),
      }),
    ];
    const qbMock = createQueryBuilderMock([cases, 2]);
    visaCaseRepo.createQueryBuilder.mockReturnValue(qbMock);
    noteRepo.manager.query.mockResolvedValue([]);

    const result = await service.findVisaReminders(
      {
        reminderType: VisaReminderType.EXPIRING_7_DAYS,
      },
      'user-1',
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('vc-7d');
  });
}

function registerFindVisaRemindersPagingCases(
  getContext: ContextAccessor,
): void {
  it('should paginate results correctly', async () => {
    const { service, visaCaseRepo, noteRepo } = getContext();
    const cases = Array.from({ length: 5 }, (_, i) =>
      buildReminderCase({
        id: `vc-${i}`,
        caseStatus: VisaCaseStatus.IN_PROGRESS,
        expireDate: addDays(new Date(), i + 1),
      }),
    );
    const qbMock = createQueryBuilderMock([cases, 5]);
    visaCaseRepo.createQueryBuilder.mockReturnValue(qbMock);
    noteRepo.manager.query.mockResolvedValue([]);

    const result = await service.findVisaReminders(
      { page: 2, pageSize: 2 },
      'user-1',
    );

    expect(result.total).toBe(5);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(2);
    expect(result.items).toHaveLength(2);
  });

  it('should return empty list with zero summary when no cases match', async () => {
    const { service, visaCaseRepo, noteRepo } = getContext();
    const qbMock = createQueryBuilderMock([[], 0]);
    visaCaseRepo.createQueryBuilder.mockReturnValue(qbMock);
    noteRepo.manager.query.mockResolvedValue([]);

    const result = await service.findVisaReminders({}, 'user-1');

    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });
}
