import { NotFoundException } from '@nestjs/common';
import { In } from 'typeorm';

import { MaterialStatus, VisaCaseStatus } from '../../common/constants/enums';
import {
  createMockCustomer,
  createMockPersonalCustomer,
  type CustomerServiceTestContext,
} from './customer.service.spec.mocks';
import { CustomerListPrimaryVisaCaseService } from './customer-list-primary-visa-case.service';
import { PersonInfo } from './entities/person-info.entity';

const LIST_PRIMARY_SUMMARY_SELF_SHAPE = {
  visaCaseId: 'vc-1',
  caseType: '技術・人文知識・国際業務',
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

/**
 * 断言 `findOneWithListPrimaryVisaCase` 在本人有/无主展示摘要时的来源字段与列表契约一致。
 *
 * @param context - CustomerService 测试上下文
 * @param getVisaCaseDataScope - 返回含 `resolve` mock 的签证范围服务替身
 */
async function assertFindOneListPrimarySelfAndNullCases(
  context: CustomerServiceTestContext,
  getVisaCaseDataScope: () => { resolve: jest.Mock },
): Promise<void> {
  const mockCustomer = createMockCustomer();
  context.getCustomerRepo().findOne.mockResolvedValue(mockCustomer);
  const spy1 = jest
    .spyOn(
      CustomerListPrimaryVisaCaseService.prototype,
      'fetchCustomerListPrimaryVisaCaseMap',
    )
    .mockResolvedValueOnce(
      new Map([['cust-1', LIST_PRIMARY_SUMMARY_SELF_SHAPE]]),
    );
  let result = await context
    .getService()
    .findOneWithListPrimaryVisaCase('cust-1', 'user-1');
  expect(getVisaCaseDataScope().resolve).toHaveBeenCalledWith(
    'user-1',
    undefined,
  );
  expect(result.listPrimaryVisaCase).toEqual(LIST_PRIMARY_SUMMARY_SELF_SHAPE);
  expect(result.listPrimaryVisaCaseSource).toBe('SELF');
  expect(result.primaryCustomerIdForListFallback).toBeNull();
  expect(result.id).toBe('cust-1');
  spy1.mockRestore();

  const spy2 = jest
    .spyOn(
      CustomerListPrimaryVisaCaseService.prototype,
      'fetchCustomerListPrimaryVisaCaseMap',
    )
    .mockResolvedValueOnce(new Map([['cust-1', null]]));
  result = await context
    .getService()
    .findOneWithListPrimaryVisaCase('cust-1', 'user-1');
  expect(result.listPrimaryVisaCase).toBeNull();
  expect(result.listPrimaryVisaCaseSource).toBeNull();
  expect(result.primaryCustomerIdForListFallback).toBeNull();
  spy2.mockRestore();
}

/**
 * 断言家属行在无本人摘要时回退主客户主展示摘要，与 `findAll` 装配同源。
 *
 * @param context - CustomerService 测试上下文
 */
async function assertFindOneListPrimaryPrimaryCustomerFallback(
  context: CustomerServiceTestContext,
): Promise<void> {
  const primaryId = 'primary-1';
  const familyCustomer = createMockPersonalCustomer({
    id: 'family-1',
    customerCode: 'P00002',
    personInfo: {
      id: 'pi-family',
      customerId: 'family-1',
      nationality: '中国',
      residenceStatus: null,
      passportNumber: null,
      residenceExpireDate: null,
      isFamilyMember: true,
      primaryCustomerId: primaryId,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as PersonInfo,
  });
  context.getCustomerRepo().findOne.mockResolvedValue(familyCustomer);
  context.getCustomerRepo().find.mockResolvedValueOnce([{ id: primaryId }]);

  const primarySummary = {
    visaCaseId: 'vc-primary',
    caseType: '家族滞在',
    caseStatus: VisaCaseStatus.IN_PROGRESS,
    expireDate: null,
    nextFollowUpAt: null,
    assignedToUserId: null,
    assignedToDisplayName: null,
    isFamilyCase: true,
    familyLinkMode: null,
    familyDependentsCount: 1,
    materialStatus: null,
    materialChecklistTotal: 0,
    materialChecklistCollected: 0,
    materialChecklistNotApplicable: 0,
    materialChecklistSuggestedStatus: MaterialStatus.NOT_RECEIVED,
    materialChecklistOutOfSync: false,
  };

  const spy = jest
    .spyOn(
      CustomerListPrimaryVisaCaseService.prototype,
      'fetchCustomerListPrimaryVisaCaseMap',
    )
    .mockResolvedValueOnce(new Map([[familyCustomer.id, null]]))
    .mockResolvedValueOnce(new Map([[primaryId, primarySummary]]));

  const result = await context
    .getService()
    .findOneWithListPrimaryVisaCase(familyCustomer.id, 'user-1');

  expect(result.listPrimaryVisaCase).toEqual(primarySummary);
  expect(result.listPrimaryVisaCaseSource).toBe('PRIMARY_CUSTOMER_FALLBACK');
  expect(result.primaryCustomerIdForListFallback).toBe(primaryId);
  expect(context.getCustomerRepo().find).toHaveBeenCalledWith({
    where: { id: In([primaryId]) },
    select: ['id'],
  });
  spy.mockRestore();
}

function registerFindOneWithListPrimaryVisaCaseTests(
  context: CustomerServiceTestContext,
  getVisaCaseDataScope: () => { resolve: jest.Mock },
): void {
  describe('findOneWithListPrimaryVisaCase', () => {
    it('should resolve scope with undefined dataScope and attach primary summary or null', async () => {
      await assertFindOneListPrimarySelfAndNullCases(
        context,
        getVisaCaseDataScope,
      );
    });

    it('should attach primary customer fallback summary when family member has no self case', async () => {
      await assertFindOneListPrimaryPrimaryCustomerFallback(context);
    });
  });
}

/**
 * 登记 `findOne` / `findOneWithListPrimaryVisaCase` 相关用例，供主 spec 复用同一套 mock 上下文。
 *
 * @param context - CustomerService 测试上下文
 * @param getVisaCaseDataScope - 返回含 `resolve` mock 的签证范围服务替身
 */
export function registerFindOneTests(
  context: CustomerServiceTestContext,
  getVisaCaseDataScope: () => { resolve: jest.Mock },
): void {
  describe('findOne', () => {
    it('should return customer with relations', async () => {
      const mockCustomer = createMockCustomer();
      context.getCustomerRepo().findOne.mockResolvedValue(mockCustomer);

      const result = await context.getService().findOne('cust-1');

      expect(result.id).toBe('cust-1');
      expect(context.getCustomerRepo().findOne).toHaveBeenCalledWith({
        where: { id: 'cust-1' },
        relations: [
          'companyInfo',
          'personInfo',
          'owner',
          'staffRelations',
          'staffRelations.user',
        ],
      });
    });

    it('should throw NotFoundException for non-existent customer', async () => {
      context.getCustomerRepo().findOne.mockResolvedValue(null);

      await expect(context.getService().findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  registerFindOneWithListPrimaryVisaCaseTests(context, getVisaCaseDataScope);
}
