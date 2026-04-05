import { In } from 'typeorm';

import type { VisaCase } from './entities/visa-case.entity';
import type { ContextAccessor } from './visa-case.service.spec-helpers';
import {
  buildVisaCaseRecord,
  createQueryBuilderMock,
} from './visa-case.service.spec-helpers';

const FIND_ALL_GLOBAL_RELATIONS = [
  'assignee',
  'creator',
  'internalPrimaryCustomer',
  'familyMembers',
  'familyMembers.customer',
  'customer',
] as const;

/**
 * 注册 `findAllGlobal` 二次加载关联与基础分页行为单测。
 *
 * @param getContext - 返回 VisaCaseService 与 mock 仓库的访问器
 */
export function registerFindAllGlobalCoreTests(
  getContext: ContextAccessor,
): void {
  describe('findAllGlobal (core)', () => {
    const custId = '11111111-1111-4111-8111-111111111111';

    it('should load relations via find and map customerName / customerCode', async () => {
      const { service, visaCaseRepo, noteRepo } = getContext();
      noteRepo.manager.query.mockResolvedValue([]);
      const mockCase = buildVisaCaseRecord({
        customer: { customerName: '顧客A', customerCode: 'C001' },
      });
      const qb = createQueryBuilderMock([[{ id: 'vc-1' }], 1]);
      visaCaseRepo.createQueryBuilder.mockReturnValue(qb);
      visaCaseRepo.find.mockResolvedValue([mockCase as unknown as VisaCase]);

      const result = await service.findAllGlobal(
        { page: 1, pageSize: 20 },
        'user-1',
      );

      expect(result.items[0].customerName).toBe('顧客A');
      expect(result.items[0].customerCode).toBe('C001');
      expect(qb.leftJoinAndSelect).not.toHaveBeenCalled();
      expect(visaCaseRepo.find).toHaveBeenCalledWith({
        where: { id: In(['vc-1']) },
        relations: [...FIND_ALL_GLOBAL_RELATIONS],
      });
      expect(qb.orderBy).toHaveBeenCalled();
      expect(qb.addOrderBy).toHaveBeenCalled();
      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(20);
    });

    it('should apply customerId filter', async () => {
      const { service, visaCaseRepo, noteRepo } = getContext();
      noteRepo.manager.query.mockResolvedValue([]);
      const qb = createQueryBuilderMock([[], 0]);
      visaCaseRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAllGlobal(
        {
          page: 1,
          pageSize: 10,
          customerId: custId,
        },
        'user-1',
      );

      expect(qb.andWhere).toHaveBeenCalledWith('vc.customerId = :customerId', {
        customerId: custId,
      });
    });
  });
}
