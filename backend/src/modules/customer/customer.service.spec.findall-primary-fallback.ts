import { MaterialStatus, VisaCaseStatus } from '../../common/constants/enums';
import {
  createFindAllQueryBuilder,
  createMockPersonalCustomer,
  type CustomerServiceTestContext,
} from './customer.service.spec.mocks';
import { CustomerListPrimaryVisaCaseService } from './customer-list-primary-visa-case.service';
import { PersonInfo } from './entities/person-info.entity';

/**
 * `findAll` 家属行主客户摘要回退装配的专项用例（与 `registerFindAllTests` 分拆以满足 max-lines-per-function）。
 *
 * @param context - 与主 `CustomerService` 测试套件共享的 mock 上下文
 */
export function registerFindAllPrimaryFallbackTests(
  context: CustomerServiceTestContext,
): void {
  describe('findAll listPrimaryVisaCase primary-customer fallback', () => {
    it('家属本人无摘要时批量回退主客户 listPrimaryVisaCase 并标注来源', async () => {
      const primaryCustomerId = 'primary-cust-1';
      const familyCustomer = createMockPersonalCustomer({
        id: 'family-cust-1',
        personInfo: {
          id: 'pi-fam',
          customerId: 'family-cust-1',
          nationality: '日本',
          residenceStatus: null,
          passportNumber: null,
          residenceExpireDate: null,
          isFamilyMember: true,
          primaryCustomerId,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as PersonInfo,
      });
      const qb = createFindAllQueryBuilder([[familyCustomer], 1]);
      context.getCustomerRepo().createQueryBuilder.mockReturnValue(qb);
      context
        .getCustomerRepo()
        .find.mockResolvedValue([{ id: primaryCustomerId }]);

      const primarySummary = {
        visaCaseId: 'vc-1',
        caseType: 'WORK',
        caseStatus: VisaCaseStatus.IN_PROGRESS,
        expireDate: null,
        nextFollowUpAt: null,
        assignedToUserId: null,
        assignedToDisplayName: null,
        isFamilyCase: false,
        familyLinkMode: null,
        familyDependentsCount: 0,
        materialStatus: null,
        materialChecklistTotal: 0,
        materialChecklistCollected: 0,
        materialChecklistNotApplicable: 0,
        materialChecklistSuggestedStatus: MaterialStatus.NOT_RECEIVED,
        materialChecklistOutOfSync: false,
      };

      const fetchSpy = jest
        .spyOn(
          CustomerListPrimaryVisaCaseService.prototype,
          'fetchCustomerListPrimaryVisaCaseMap',
        )
        .mockImplementation((ids: string[]) => {
          const m = new Map<string, typeof primarySummary | null>();
          for (const id of ids) {
            m.set(id, id === primaryCustomerId ? primarySummary : null);
          }
          return Promise.resolve(m);
        });

      const result = await context
        .getService()
        .findAll({ page: 1, pageSize: 20 }, 'user-1');

      expect(context.getCustomerRepo().find).toHaveBeenCalled();
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(result.items[0].listPrimaryVisaCase).toEqual(primarySummary);
      expect(result.items[0].listPrimaryVisaCaseSource).toBe(
        'PRIMARY_CUSTOMER_FALLBACK',
      );
      expect(result.items[0].primaryCustomerIdForListFallback).toBe(
        primaryCustomerId,
      );

      fetchSpy.mockRestore();
    });
  });
}
