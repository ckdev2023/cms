import {
  CustomerType,
  MaterialStatus,
  VisaCaseStatus,
} from '../../common/constants/enums';
import type { CustomerListPrimaryVisaCaseSummaryDto } from './customer.service.types';
import { resolveCustomerListPrimaryVisaCaseDisplay } from './customer-list-primary-customer-fallback.resolve';
import type { Customer } from './entities/customer.entity';

const selfId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const primaryId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function mockSummary(
  overrides: Partial<CustomerListPrimaryVisaCaseSummaryDto> = {},
): CustomerListPrimaryVisaCaseSummaryDto {
  return {
    visaCaseId: '11111111-1111-4111-8111-111111111111',
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
    ...overrides,
  };
}

function customerStub(
  partial: Partial<Customer> & Pick<Customer, 'id'>,
): Customer {
  return {
    customerCode: 'C',
    customerName: 'N',
    customerType: CustomerType.PERSONAL,
    serviceType: 'ADMIN',
    status: 'ACTIVE',
    phone: null,
    email: null,
    wechatId: null,
    lineId: null,
    address: null,
    ownerUserId: null,
    createdBy: null,
    updatedBy: null,
    owner: null,
    companyInfo: null,
    personInfo: null,
    notes: [],
    staffRelations: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...partial,
  } as Customer;
}

function familyPersonInfo(
  primary: string | null,
  isMember = true,
): Customer['personInfo'] {
  return {
    isFamilyMember: isMember,
    primaryCustomerId: primary,
  } as Customer['personInfo'];
}

describe('resolveCustomerListPrimaryVisaCaseDisplay — SELF', () => {
  it('本人有可见主展示案件时返回 SELF 且不回退', () => {
    const self = mockSummary();
    const r = resolveCustomerListPrimaryVisaCaseDisplay(
      customerStub({
        id: selfId,
        customerType: CustomerType.PERSONAL,
        personInfo: familyPersonInfo(primaryId),
      }),
      self,
      new Map([[primaryId, mockSummary({ visaCaseId: 'other' })]]),
      new Set([primaryId]),
    );
    expect(r.listPrimaryVisaCase).toBe(self);
    expect(r.listPrimaryVisaCaseSource).toBe('SELF');
    expect(r.primaryCustomerIdForListFallback).toBeNull();
  });

  it('本人优先：非个人客户在本人有摘要时仍返回 SELF，不进入回退分支', () => {
    const self = mockSummary();
    const r = resolveCustomerListPrimaryVisaCaseDisplay(
      customerStub({
        id: selfId,
        customerType: CustomerType.COMPANY,
        personInfo: null,
      }),
      self,
      new Map([[primaryId, mockSummary({ visaCaseId: 'other' })]]),
      new Set([primaryId]),
    );
    expect(r.listPrimaryVisaCase).toBe(self);
    expect(r.listPrimaryVisaCaseSource).toBe('SELF');
    expect(r.primaryCustomerIdForListFallback).toBeNull();
  });
});

describe('resolveCustomerListPrimaryVisaCaseDisplay — PRIMARY_CUSTOMER_FALLBACK', () => {
  it('家属本人无案件、主客户有可见摘要时回退（验收 §8.1）', () => {
    const primarySummary = mockSummary();
    const r = resolveCustomerListPrimaryVisaCaseDisplay(
      customerStub({
        id: selfId,
        personInfo: familyPersonInfo(primaryId),
      }),
      null,
      new Map([[primaryId, primarySummary]]),
      new Set([primaryId]),
    );
    expect(r.listPrimaryVisaCase).toBe(primarySummary);
    expect(r.listPrimaryVisaCaseSource).toBe('PRIMARY_CUSTOMER_FALLBACK');
    expect(r.primaryCustomerIdForListFallback).toBe(primaryId);
  });
});

describe('resolveCustomerListPrimaryVisaCaseDisplay — 主摘要不可用则不回退', () => {
  it('主客户在 dataScope 下无可见案件（验收 §8.2）', () => {
    const r = resolveCustomerListPrimaryVisaCaseDisplay(
      customerStub({
        id: selfId,
        personInfo: familyPersonInfo(primaryId),
      }),
      null,
      new Map([[primaryId, null]]),
      new Set([primaryId]),
    );
    expect(r.listPrimaryVisaCase).toBeNull();
    expect(r.listPrimaryVisaCaseSource).toBeNull();
    expect(r.primaryCustomerIdForListFallback).toBeNull();
  });

  it('主客户不存在或已删（验收 §8.3）', () => {
    const r = resolveCustomerListPrimaryVisaCaseDisplay(
      customerStub({
        id: selfId,
        personInfo: familyPersonInfo(primaryId),
      }),
      null,
      new Map([[primaryId, mockSummary()]]),
      new Set(),
    );
    expect(r.listPrimaryVisaCase).toBeNull();
    expect(r.listPrimaryVisaCaseSource).toBeNull();
    expect(r.primaryCustomerIdForListFallback).toBeNull();
  });

  it('非法自指 primary_customer_id', () => {
    const r = resolveCustomerListPrimaryVisaCaseDisplay(
      customerStub({
        id: selfId,
        personInfo: familyPersonInfo(selfId),
      }),
      null,
      new Map([[selfId, mockSummary()]]),
      new Set([selfId]),
    );
    expect(r.listPrimaryVisaCase).toBeNull();
    expect(r.listPrimaryVisaCaseSource).toBeNull();
    expect(r.primaryCustomerIdForListFallback).toBeNull();
  });

  it('primaryCaseMap 未包含主客户键时等同无可见摘要（§5.2.5）', () => {
    const r = resolveCustomerListPrimaryVisaCaseDisplay(
      customerStub({
        id: selfId,
        personInfo: familyPersonInfo(primaryId),
      }),
      null,
      new Map(),
      new Set([primaryId]),
    );
    expect(r.listPrimaryVisaCase).toBeNull();
    expect(r.listPrimaryVisaCaseSource).toBeNull();
    expect(r.primaryCustomerIdForListFallback).toBeNull();
  });
});

describe('resolveCustomerListPrimaryVisaCaseDisplay — §5.2 身份条件（类型与家属标记）', () => {
  it('非个人客户', () => {
    const r = resolveCustomerListPrimaryVisaCaseDisplay(
      customerStub({
        id: selfId,
        customerType: CustomerType.COMPANY,
        personInfo: null,
      }),
      null,
      new Map([[primaryId, mockSummary()]]),
      new Set([primaryId]),
    );
    expect(r.listPrimaryVisaCase).toBeNull();
    expect(r.listPrimaryVisaCaseSource).toBeNull();
  });

  it('非家属', () => {
    const r = resolveCustomerListPrimaryVisaCaseDisplay(
      customerStub({
        id: selfId,
        personInfo: familyPersonInfo(primaryId, false),
      }),
      null,
      new Map([[primaryId, mockSummary()]]),
      new Set([primaryId]),
    );
    expect(r.listPrimaryVisaCase).toBeNull();
  });

  it('家属但未设 primary_customer_id', () => {
    const r = resolveCustomerListPrimaryVisaCaseDisplay(
      customerStub({
        id: selfId,
        personInfo: familyPersonInfo(null),
      }),
      null,
      new Map([[primaryId, mockSummary()]]),
      new Set([primaryId]),
    );
    expect(r.listPrimaryVisaCase).toBeNull();
  });
});

describe('resolveCustomerListPrimaryVisaCaseDisplay — §5.2 身份条件（person_info 与主档键）', () => {
  it('§5.2.2：primary_customer_id 为空字符串视为未设置，不回退', () => {
    const r = resolveCustomerListPrimaryVisaCaseDisplay(
      customerStub({
        id: selfId,
        personInfo: familyPersonInfo(''),
      }),
      null,
      new Map([[primaryId, mockSummary()]]),
      new Set([primaryId]),
    );
    expect(r.listPrimaryVisaCase).toBeNull();
    expect(r.listPrimaryVisaCaseSource).toBeNull();
    expect(r.primaryCustomerIdForListFallback).toBeNull();
  });

  it('§5.2.2：is_family_member 须为 true，undefined 不回退', () => {
    const r = resolveCustomerListPrimaryVisaCaseDisplay(
      customerStub({
        id: selfId,
        personInfo: {
          isFamilyMember: undefined,
          primaryCustomerId: primaryId,
        } as unknown as Customer['personInfo'],
      }),
      null,
      new Map([[primaryId, mockSummary()]]),
      new Set([primaryId]),
    );
    expect(r.listPrimaryVisaCase).toBeNull();
    expect(r.listPrimaryVisaCaseSource).toBeNull();
  });

  it('§5.2.1：个人客户无 person_info 时不回退', () => {
    const r = resolveCustomerListPrimaryVisaCaseDisplay(
      customerStub({
        id: selfId,
        customerType: CustomerType.PERSONAL,
        personInfo: null,
      }),
      null,
      new Map([[primaryId, mockSummary()]]),
      new Set([primaryId]),
    );
    expect(r.listPrimaryVisaCase).toBeNull();
    expect(r.listPrimaryVisaCaseSource).toBeNull();
  });
});
