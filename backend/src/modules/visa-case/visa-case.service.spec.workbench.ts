import type { ContextAccessor } from './visa-case.service.spec-helpers';
import type {
  VisaDomainStatsDto,
  VisaWorkbenchReminderPreviewsDto,
} from './visa-case.types';
import { VisaCaseReminderService } from './visa-case-reminder.service';

function mockEmptyStats(): VisaDomainStatsDto {
  return {
    caseStatusCounts: [],
    reminderBuckets: {
      supplement: 0,
      todayFollowUp: 0,
      expiring7Days: 0,
      expiring2Months: 0,
      noBucket: 0,
    },
    expiringWithin7DaysWindow: 0,
    todayFollowUpCount: 0,
    supplementRelatedCount: 0,
    unassignedCount: 0,
  };
}

function mockEmptyPreviews(): VisaWorkbenchReminderPreviewsDto {
  return {
    supplement: [],
    todayFollowUp: [],
    expiring7Days: [],
    expiring2Months: [],
  };
}

function registerWorkbenchMergeTest(getContext: ContextAccessor): void {
  it('should merge stats and per-bucket previews with default previewLimit 5', async () => {
    const { service, module } = getContext();
    const reminder = module.get(VisaCaseReminderService);
    const stats: VisaDomainStatsDto = {
      ...mockEmptyStats(),
      reminderBuckets: {
        supplement: 1,
        todayFollowUp: 0,
        expiring7Days: 0,
        expiring2Months: 0,
        noBucket: 0,
      },
      supplementRelatedCount: 1,
    };
    const previews = mockEmptyPreviews();
    const statsSpy = jest
      .spyOn(reminder, 'getVisaDomainStats')
      .mockResolvedValue(stats);
    const previewSpy = jest
      .spyOn(reminder, 'getReminderPreviewsByBucket')
      .mockResolvedValue(previews);

    const result = await service.getVisaWorkbenchAggregate({}, 'user-1');

    expect(result.stats).toBe(stats);
    expect(result.reminderPreviews).toBe(previews);
    expect(statsSpy).toHaveBeenCalledWith(
      { assignedTo: undefined, dataScope: undefined },
      'user-1',
    );
    expect(previewSpy).toHaveBeenCalledWith(
      { assignedTo: undefined, dataScope: undefined },
      5,
      'user-1',
    );
  });
}

function registerWorkbenchLimitClampTest(getContext: ContextAccessor): void {
  it('should clamp previewLimit above 20 to 20 and pass 0 without raising minimum', async () => {
    const { service, module } = getContext();
    const reminder = module.get(VisaCaseReminderService);
    jest
      .spyOn(reminder, 'getVisaDomainStats')
      .mockResolvedValue(mockEmptyStats());
    const previewSpy = jest
      .spyOn(reminder, 'getReminderPreviewsByBucket')
      .mockResolvedValue(mockEmptyPreviews());

    await service.getVisaWorkbenchAggregate({ previewLimit: 0 }, 'user-1');
    expect(previewSpy).toHaveBeenLastCalledWith(
      expect.any(Object),
      0,
      'user-1',
    );

    await service.getVisaWorkbenchAggregate({ previewLimit: 99 }, 'user-1');
    expect(previewSpy).toHaveBeenLastCalledWith(
      expect.any(Object),
      20,
      'user-1',
    );
  });
}

function registerWorkbenchAssignedToTest(getContext: ContextAccessor): void {
  it('should pass assignedTo to both underlying calls', async () => {
    const { service, module } = getContext();
    const reminder = module.get(VisaCaseReminderService);
    const statsSpy = jest
      .spyOn(reminder, 'getVisaDomainStats')
      .mockResolvedValue(mockEmptyStats());
    const previewSpy = jest
      .spyOn(reminder, 'getReminderPreviewsByBucket')
      .mockResolvedValue(mockEmptyPreviews());

    const uid = '11111111-1111-4111-8111-111111111111';
    await service.getVisaWorkbenchAggregate(
      {
        assignedTo: uid,
        previewLimit: 3,
      },
      'user-1',
    );

    expect(statsSpy).toHaveBeenCalledWith(
      { assignedTo: uid, dataScope: undefined },
      'user-1',
    );
    expect(previewSpy).toHaveBeenCalledWith(
      { assignedTo: uid, dataScope: undefined },
      3,
      'user-1',
    );
  });
}

/**
 * 校验工作台聚合并行调用统计与每桶预览，且负责人与 previewLimit 透传正确。
 */
export function registerGetVisaWorkbenchAggregateTests(
  getContext: ContextAccessor,
): void {
  describe('getVisaWorkbenchAggregate', () => {
    registerWorkbenchMergeTest(getContext);
    registerWorkbenchLimitClampTest(getContext);
    registerWorkbenchAssignedToTest(getContext);
  });
}
