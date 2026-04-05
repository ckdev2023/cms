import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { MaterialStatus, VisaCaseStatus } from '../../common/constants/enums';
import { VisaCase } from '../visa-case/entities/visa-case.entity';
import { CustomerListPrimaryVisaCaseService } from './customer-list-primary-visa-case.service';

/**
 * 装配带 mock `query` 的 `CustomerListPrimaryVisaCaseService`，供各用例独立初始化。
 *
 * @returns 服务实例与 `visaCaseRepo.query` mock
 */
async function createPrimaryVisaCaseServiceTestModule(): Promise<{
  service: CustomerListPrimaryVisaCaseService;
  query: jest.Mock;
}> {
  const query = jest.fn().mockResolvedValue([]);
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      CustomerListPrimaryVisaCaseService,
      { provide: getRepositoryToken(VisaCase), useValue: { query } },
    ],
  }).compile();

  return {
    service: module.get(CustomerListPrimaryVisaCaseService),
    query,
  };
}

describe('CustomerListPrimaryVisaCaseService · SQL contract', () => {
  it('returns null for every requested id when the SQL returns no rows', async () => {
    const { service, query } = await createPrimaryVisaCaseServiceTestModule();
    const map = await service.fetchCustomerListPrimaryVisaCaseMap(
      ['c1', 'c2'],
      {
        mode: 'all',
      },
    );

    expect(map.get('c1')).toBeNull();
    expect(map.get('c2')).toBeNull();
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('DISTINCT ON (vc.customer_id)'),
      [['c1', 'c2'], VisaCaseStatus.COMPLETED, VisaCaseStatus.CANCELLED],
    );
  });

  it('appends mine-scope predicate and bound user id as fourth SQL parameter', async () => {
    const { service, query } = await createPrimaryVisaCaseServiceTestModule();
    query.mockResolvedValue([]);
    await service.fetchCustomerListPrimaryVisaCaseMap(['c1'], {
      mode: 'mine',
      userId: 'user-scope',
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('AND vc.assigned_to = $4'),
      [
        ['c1'],
        VisaCaseStatus.COMPLETED,
        VisaCaseStatus.CANCELLED,
        'user-scope',
      ],
    );
  });
});

describe('CustomerListPrimaryVisaCaseService · row mapping (core fields)', () => {
  it('maps driver-shaped rows with camelCase aliases into summary DTOs', async () => {
    const { service, query } = await createPrimaryVisaCaseServiceTestModule();
    query.mockResolvedValue([
      {
        customerId: 'c1',
        visaCaseId: 'vc1',
        caseType: '技人国',
        caseStatus: VisaCaseStatus.IN_PROGRESS,
        expireDate: '2026-06-01',
        nextFollowUpAt: '2026-05-01T10:00:00.000Z',
        assignedToUserId: 'u1',
        assignedToDisplayName: '担当者',
      },
    ]);

    const map = await service.fetchCustomerListPrimaryVisaCaseMap(['c1'], {
      mode: 'all',
    });
    const summary = map.get('c1');
    expect(summary).not.toBeNull();

    expect(summary).toMatchObject({
      visaCaseId: 'vc1',
      caseType: '技人国',
      caseStatus: VisaCaseStatus.IN_PROGRESS,
      assignedToUserId: 'u1',
      assignedToDisplayName: '担当者',
    });
    expect(summary!.expireDate).toBeInstanceOf(Date);
    expect(summary!.nextFollowUpAt).toBeInstanceOf(Date);
    expect(summary!.isFamilyCase).toBe(false);
    expect(summary!.familyLinkMode).toBeNull();
    expect(summary!.familyDependentsCount).toBe(0);
    expect(summary!.materialStatus).toBeNull();
    expect(summary!.materialChecklistTotal).toBe(0);
    expect(summary!.materialChecklistCollected).toBe(0);
    expect(summary!.materialChecklistNotApplicable).toBe(0);
    expect(summary!.materialChecklistSuggestedStatus).toBe(
      MaterialStatus.NOT_RECEIVED,
    );
    expect(summary!.materialChecklistOutOfSync).toBe(false);
  });
});

describe('CustomerListPrimaryVisaCaseService · row mapping (aliases & family)', () => {
  it('accepts snake_case column aliases from raw drivers', async () => {
    const { service, query } = await createPrimaryVisaCaseServiceTestModule();
    query.mockResolvedValue([
      {
        customer_id: 'c9',
        visa_case_id: 'vc9',
        case_type: null,
        case_status: VisaCaseStatus.DRAFT,
        expire_date: null,
        next_follow_up_at: null,
        assigned_to_user_id: null,
        assigned_to_display_name: null,
      },
    ]);

    const map = await service.fetchCustomerListPrimaryVisaCaseMap(['c9'], {
      mode: 'all',
    });

    expect(map.get('c9')).toMatchObject({
      visaCaseId: 'vc9',
      caseType: null,
      caseStatus: VisaCaseStatus.DRAFT,
      expireDate: null,
      nextFollowUpAt: null,
      assignedToUserId: null,
      assignedToDisplayName: null,
      isFamilyCase: false,
      familyLinkMode: null,
      familyDependentsCount: 0,
      materialStatus: null,
      materialChecklistTotal: 0,
      materialChecklistSuggestedStatus: MaterialStatus.NOT_RECEIVED,
      materialChecklistOutOfSync: false,
    });
  });

  it('maps family and material columns when present', async () => {
    const { service, query } = await createPrimaryVisaCaseServiceTestModule();
    query.mockResolvedValue([
      {
        customerId: 'cf',
        visaCaseId: 'vf1',
        caseType: '家族',
        caseStatus: VisaCaseStatus.IN_PROGRESS,
        expireDate: null,
        nextFollowUpAt: null,
        assignedToUserId: null,
        assignedToDisplayName: null,
        isFamilyCase: true,
        familyLinkMode: 'INTERNAL',
        materialStatus: 'PARTIAL',
        familyDependentsCount: 2,
      },
    ]);

    const map = await service.fetchCustomerListPrimaryVisaCaseMap(['cf'], {
      mode: 'all',
    });
    expect(map.get('cf')).toMatchObject({
      isFamilyCase: true,
      familyLinkMode: 'INTERNAL',
      familyDependentsCount: 2,
      materialStatus: 'PARTIAL',
      materialChecklistTotal: 0,
      materialChecklistSuggestedStatus: MaterialStatus.NOT_RECEIVED,
      materialChecklistOutOfSync: true,
    });
  });
});

describe('CustomerListPrimaryVisaCaseService · checklist summary linkage', () => {
  it('maps checklist counts into suggested status and outOfSync vs persisted', async () => {
    const { service, query } = await createPrimaryVisaCaseServiceTestModule();
    query.mockResolvedValue([
      {
        customerId: 'cmat',
        visaCaseId: 'vmat',
        caseType: null,
        caseStatus: VisaCaseStatus.IN_PROGRESS,
        expireDate: null,
        nextFollowUpAt: null,
        assignedToUserId: null,
        assignedToDisplayName: null,
        isFamilyCase: false,
        familyLinkMode: null,
        familyDependentsCount: 0,
        materialStatus: 'PARTIAL',
        materialChecklistTotal: 4,
        materialChecklistCollected: 4,
        materialChecklistNotApplicable: 0,
      },
    ]);

    const map = await service.fetchCustomerListPrimaryVisaCaseMap(['cmat'], {
      mode: 'all',
    });
    expect(map.get('cmat')).toMatchObject({
      materialChecklistTotal: 4,
      materialChecklistCollected: 4,
      materialChecklistNotApplicable: 0,
      materialChecklistSuggestedStatus: MaterialStatus.COMPLETE,
      materialChecklistOutOfSync: true,
    });
  });
});

describe('CustomerListPrimaryVisaCaseService · familyDependentsCount', () => {
  it('maps familyDependentsCount from snake_case alias', async () => {
    const { service, query } = await createPrimaryVisaCaseServiceTestModule();
    query.mockResolvedValue([
      {
        customerId: 'cdep',
        visaCaseId: 'vdep',
        caseType: null,
        caseStatus: VisaCaseStatus.IN_PROGRESS,
        expireDate: null,
        nextFollowUpAt: null,
        assignedToUserId: null,
        assignedToDisplayName: null,
        is_family_case: true,
        family_link_mode: 'EXTERNAL',
        family_dependents_count: '3',
        material_status: null,
      },
    ]);

    const map = await service.fetchCustomerListPrimaryVisaCaseMap(['cdep'], {
      mode: 'all',
    });
    expect(map.get('cdep')).toMatchObject({
      familyDependentsCount: 3,
      familyLinkMode: 'EXTERNAL',
    });
  });
});
