import {
  MaterialStatus,
  VisaCaseFeeStatus,
  VisaCaseStatus,
  VisaReminderType,
} from '../../common/constants/enums';
import type { ContextAccessor } from './visa-case.service.spec-helpers';
import { createQueryBuilderMock } from './visa-case.service.spec-helpers';

/**
 * 注册 `findAllGlobal` 多选筛选、提醒桶与分页上限单测。
 *
 * @param getContext - 返回 VisaCaseService 与 mock 仓库的访问器
 */
export function registerFindAllGlobalFilterTests(
  getContext: ContextAccessor,
): void {
  describe('findAllGlobal (filters)', () => {
    it('should apply caseStatuses and materialStatuses IN filters', async () => {
      const { service, visaCaseRepo, noteRepo } = getContext();
      noteRepo.manager.query.mockResolvedValue([]);
      const qb = createQueryBuilderMock([[], 0]);
      visaCaseRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAllGlobal(
        {
          page: 1,
          pageSize: 10,
          caseStatuses: [VisaCaseStatus.IN_PROGRESS, VisaCaseStatus.SUBMITTED],
          materialStatuses: [MaterialStatus.PARTIAL],
          feeStatuses: [VisaCaseFeeStatus.NOT_BILLED],
        },
        'user-1',
      );

      expect(qb.andWhere).toHaveBeenCalledWith(
        'vc.caseStatus IN (:...caseStatuses)',
        {
          caseStatuses: [VisaCaseStatus.IN_PROGRESS, VisaCaseStatus.SUBMITTED],
        },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'vc.materialStatus IN (:...materialStatuses)',
        { materialStatuses: [MaterialStatus.PARTIAL] },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'vc.feeStatus IN (:...feeStatuses)',
        { feeStatuses: [VisaCaseFeeStatus.NOT_BILLED] },
      );
    });

    it('should exclude completed/cancelled when reminderBucket is set', async () => {
      const { service, visaCaseRepo, noteRepo } = getContext();
      noteRepo.manager.query.mockResolvedValue([]);
      const qb = createQueryBuilderMock([[], 0]);
      visaCaseRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAllGlobal(
        {
          page: 1,
          pageSize: 10,
          reminderBucket: VisaReminderType.SUPPLEMENT,
        },
        'user-1',
      );

      expect(qb.andWhere).toHaveBeenCalledWith(
        'vc.caseStatus NOT IN (:...rbExcluded)',
        {
          rbExcluded: [VisaCaseStatus.COMPLETED, VisaCaseStatus.CANCELLED],
        },
      );
    });

    it('should cap pageSize at 100', async () => {
      const { service, visaCaseRepo, noteRepo } = getContext();
      noteRepo.manager.query.mockResolvedValue([]);
      const qb = createQueryBuilderMock([[], 0]);
      visaCaseRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAllGlobal({ page: 1, pageSize: 500 }, 'user-1');

      expect(qb.take).toHaveBeenCalledWith(100);
    });

    it('should filter customerKeyword via EXISTS on customers', async () => {
      const { service, visaCaseRepo, noteRepo } = getContext();
      noteRepo.manager.query.mockResolvedValue([]);
      const qb = createQueryBuilderMock([[], 0]);
      visaCaseRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAllGlobal(
        { page: 1, pageSize: 10, customerKeyword: '  foo  ' },
        'user-1',
      );

      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('gvc_cust_kw.customer_name'),
        { gvcListCustKw: '%foo%' },
      );
    });
  });
}
