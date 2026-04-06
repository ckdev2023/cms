import { BadRequestException, NotFoundException } from '@nestjs/common';

import { VisaCaseMemberRole } from '../../common/constants/enums';
import type { ContextAccessor } from './visa-case.service.spec-helpers';
import {
  buildFamilyMember,
  buildPrimaryApplicantMember,
  buildVisaCaseRecord,
  MOCK_VISA_CASE_SCOPE_ROW,
} from './visa-case.service.spec-helpers';

export function registerListFamilyMembersTests(
  getContext: ContextAccessor,
): void {
  describe('listFamilyMembers', () => {
    it('should return members sorted by primary first', () =>
      runListFamilyMembersSorted(getContext));

    it('should throw NotFoundException when case does not exist', () =>
      runListFamilyMembersCaseMissing(getContext));
  });
}

async function runListFamilyMembersSorted(
  getContext: ContextAccessor,
): Promise<void> {
  const { service, visaCaseRepo, familyMemberRepo } = getContext();
  visaCaseRepo.findOne.mockResolvedValueOnce(MOCK_VISA_CASE_SCOPE_ROW);
  visaCaseRepo.count.mockResolvedValue(1);

  const members = [buildPrimaryApplicantMember(), buildFamilyMember()];
  familyMemberRepo.find.mockResolvedValue(members);

  const result = await service.listFamilyMembers('vc-1', 'user-1');

  expect(result).toHaveLength(2);
  expect(result[0].isPrimary).toBe(true);
  expect(result[1].memberRole).toBe(VisaCaseMemberRole.SPOUSE);
}

async function runListFamilyMembersCaseMissing(
  getContext: ContextAccessor,
): Promise<void> {
  const { service, visaCaseRepo } = getContext();
  visaCaseRepo.findOne.mockResolvedValueOnce(null);

  await expect(
    service.listFamilyMembers('nonexistent', 'user-1'),
  ).rejects.toThrow(NotFoundException);
}

function registerAddFamilyMemberHappyPathTests(
  getContext: ContextAccessor,
): void {
  describe('addFamilyMember', () => {
    it('should add a non-primary family member', () =>
      runAddNonPrimaryFamilyMember(getContext));

    it('should clear existing primary when adding new primary member', () =>
      runAddFamilyMemberClearsPrimary(getContext));
  });
}

function registerAddFamilyMemberValidationTests(
  getContext: ContextAccessor,
): void {
  describe('addFamilyMember validation', () => {
    it('should reject duplicate customer in same case', () =>
      runAddFamilyMemberRejectsDuplicate(getContext));

    it('should throw NotFoundException when case does not exist', () =>
      runAddFamilyMemberCaseMissing(getContext));

    it('should throw NotFoundException when customer does not exist', () =>
      runAddFamilyMemberCustomerMissing(getContext));
  });
}

/**
 * 注册 `addFamilyMember` 相关用例（拆分为 happy path 与校验两组 describe）。
 *
 * @param getContext - 取得当前 VisaCaseService 测试上下文
 */
export function registerAddFamilyMemberTests(
  getContext: ContextAccessor,
): void {
  registerAddFamilyMemberHappyPathTests(getContext);
  registerAddFamilyMemberValidationTests(getContext);
}

async function runAddNonPrimaryFamilyMember(
  getContext: ContextAccessor,
): Promise<void> {
  const { service, visaCaseRepo, familyMemberRepo } = getContext();
  visaCaseRepo.findOne
    .mockResolvedValueOnce(MOCK_VISA_CASE_SCOPE_ROW)
    .mockResolvedValueOnce(buildVisaCaseRecord({ id: 'vc-1', caseType: null }));
  visaCaseRepo.count.mockResolvedValue(1);

  const saved = buildFamilyMember();
  familyMemberRepo.save.mockResolvedValue(saved);
  familyMemberRepo.findOne
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce(saved);

  const result = await service.addFamilyMember(
    'vc-1',
    {
      customerId: 'cust-spouse',
      memberRole: VisaCaseMemberRole.SPOUSE,
      displayNameSnapshot: '田中花子',
    },
    'user-1',
  );

  expect(result.customerId).toBe('cust-spouse');
  expect(result.memberRole).toBe(VisaCaseMemberRole.SPOUSE);
  expect(result.isPrimary).toBe(false);
}

async function runAddFamilyMemberClearsPrimary(
  getContext: ContextAccessor,
): Promise<void> {
  const { service, visaCaseRepo, familyMemberRepo } = getContext();
  visaCaseRepo.findOne
    .mockResolvedValueOnce(MOCK_VISA_CASE_SCOPE_ROW)
    .mockResolvedValueOnce(buildVisaCaseRecord({ id: 'vc-1', caseType: null }));
  visaCaseRepo.count.mockResolvedValue(1);

  const existingPrimary = buildPrimaryApplicantMember();
  const newMember = buildFamilyMember({ isPrimary: true });

  familyMemberRepo.findOne
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce(existingPrimary)
    .mockResolvedValueOnce(newMember);
  familyMemberRepo.save.mockResolvedValue(newMember);

  await service.addFamilyMember(
    'vc-1',
    {
      customerId: 'cust-spouse',
      memberRole: VisaCaseMemberRole.SPOUSE,
      isPrimary: true,
      displayNameSnapshot: '田中花子',
    },
    'user-1',
  );

  expect(familyMemberRepo.save).toHaveBeenCalledWith(
    expect.objectContaining({ isPrimary: false }),
  );
}

async function runAddFamilyMemberRejectsDuplicate(
  getContext: ContextAccessor,
): Promise<void> {
  const { service, visaCaseRepo, familyMemberRepo } = getContext();
  visaCaseRepo.findOne.mockResolvedValueOnce(MOCK_VISA_CASE_SCOPE_ROW);
  visaCaseRepo.count.mockResolvedValue(1);
  familyMemberRepo.findOne.mockResolvedValueOnce(buildFamilyMember());

  await expect(
    service.addFamilyMember(
      'vc-1',
      {
        customerId: 'cust-spouse',
        memberRole: VisaCaseMemberRole.SPOUSE,
        displayNameSnapshot: '田中花子',
      },
      'user-1',
    ),
  ).rejects.toThrow(BadRequestException);
}

async function runAddFamilyMemberCaseMissing(
  getContext: ContextAccessor,
): Promise<void> {
  const { service, visaCaseRepo } = getContext();
  visaCaseRepo.findOne.mockResolvedValueOnce(null);

  await expect(
    service.addFamilyMember(
      'nonexistent',
      {
        customerId: 'cust-spouse',
        memberRole: VisaCaseMemberRole.SPOUSE,
        displayNameSnapshot: '田中花子',
      },
      'user-1',
    ),
  ).rejects.toThrow(NotFoundException);
}

async function runAddFamilyMemberCustomerMissing(
  getContext: ContextAccessor,
): Promise<void> {
  const { service, visaCaseRepo, customerRepo, familyMemberRepo } =
    getContext();
  visaCaseRepo.findOne.mockResolvedValueOnce(MOCK_VISA_CASE_SCOPE_ROW);
  visaCaseRepo.count.mockResolvedValue(1);
  customerRepo.count.mockResolvedValue(0);
  familyMemberRepo.findOne.mockResolvedValueOnce(null);

  await expect(
    service.addFamilyMember(
      'vc-1',
      {
        customerId: 'nonexistent',
        memberRole: VisaCaseMemberRole.SPOUSE,
        displayNameSnapshot: '不存在',
      },
      'user-1',
    ),
  ).rejects.toThrow(NotFoundException);
}

export function registerUpdateFamilyMemberTests(
  getContext: ContextAccessor,
): void {
  describe('updateFamilyMember', () => {
    it('should update member role', () =>
      runUpdateFamilyMemberRole(getContext));

    it('should clear existing primary when promoting member to primary', () =>
      runUpdateFamilyMemberPromotePrimary(getContext));

    it('should throw NotFoundException when member does not exist', () =>
      runUpdateFamilyMemberMissing(getContext));
  });
}

async function runUpdateFamilyMemberRole(
  getContext: ContextAccessor,
): Promise<void> {
  const { service, visaCaseRepo, familyMemberRepo } = getContext();
  visaCaseRepo.findOne.mockResolvedValueOnce(MOCK_VISA_CASE_SCOPE_ROW);
  visaCaseRepo.count.mockResolvedValue(1);

  const member = buildFamilyMember();
  const updated = buildFamilyMember({
    memberRole: VisaCaseMemberRole.CHILD,
  });
  familyMemberRepo.findOne.mockResolvedValueOnce(member);
  familyMemberRepo.save.mockResolvedValue(updated);

  const result = await service.updateFamilyMember(
    'vc-1',
    'fm-spouse',
    {
      memberRole: VisaCaseMemberRole.CHILD,
    },
    'user-1',
  );

  expect(result.memberRole).toBe(VisaCaseMemberRole.CHILD);
}

async function runUpdateFamilyMemberPromotePrimary(
  getContext: ContextAccessor,
): Promise<void> {
  const { service, visaCaseRepo, familyMemberRepo } = getContext();
  visaCaseRepo.findOne.mockResolvedValueOnce(MOCK_VISA_CASE_SCOPE_ROW);
  visaCaseRepo.count.mockResolvedValue(1);

  const member = buildFamilyMember();
  const existingPrimary = buildPrimaryApplicantMember();
  const updated = buildFamilyMember({ isPrimary: true });

  familyMemberRepo.findOne
    .mockResolvedValueOnce(member)
    .mockResolvedValueOnce(existingPrimary);
  familyMemberRepo.save.mockResolvedValue(updated);

  await service.updateFamilyMember(
    'vc-1',
    'fm-spouse',
    {
      isPrimary: true,
    },
    'user-1',
  );

  expect(familyMemberRepo.save).toHaveBeenCalledWith(
    expect.objectContaining({ isPrimary: false }),
  );
}

async function runUpdateFamilyMemberMissing(
  getContext: ContextAccessor,
): Promise<void> {
  const { service, visaCaseRepo, familyMemberRepo } = getContext();
  visaCaseRepo.findOne.mockResolvedValueOnce(MOCK_VISA_CASE_SCOPE_ROW);
  visaCaseRepo.count.mockResolvedValue(1);
  familyMemberRepo.findOne.mockResolvedValueOnce(null);

  await expect(
    service.updateFamilyMember(
      'vc-1',
      'nonexistent',
      {
        memberRole: VisaCaseMemberRole.CHILD,
      },
      'user-1',
    ),
  ).rejects.toThrow(NotFoundException);
}

export function registerRemoveFamilyMemberTests(
  getContext: ContextAccessor,
): void {
  describe('removeFamilyMember', () => {
    it('should remove a family member', () =>
      runRemoveFamilyMemberOk(getContext));

    it('should throw NotFoundException when member does not exist', () =>
      runRemoveFamilyMemberMissing(getContext));

    it('should throw NotFoundException when case does not exist', () =>
      runRemoveFamilyMemberCaseMissing(getContext));
  });
}

async function runRemoveFamilyMemberOk(
  getContext: ContextAccessor,
): Promise<void> {
  const { service, visaCaseRepo, familyMemberRepo } = getContext();
  visaCaseRepo.findOne.mockResolvedValueOnce(MOCK_VISA_CASE_SCOPE_ROW);
  visaCaseRepo.count.mockResolvedValue(1);

  const member = buildFamilyMember();
  familyMemberRepo.findOne.mockResolvedValueOnce(member);

  await service.removeFamilyMember('vc-1', 'fm-spouse', 'user-1');

  expect(familyMemberRepo.remove).toHaveBeenCalledWith(member);
}

async function runRemoveFamilyMemberMissing(
  getContext: ContextAccessor,
): Promise<void> {
  const { service, visaCaseRepo, familyMemberRepo } = getContext();
  visaCaseRepo.findOne.mockResolvedValueOnce(MOCK_VISA_CASE_SCOPE_ROW);
  visaCaseRepo.count.mockResolvedValue(1);
  familyMemberRepo.findOne.mockResolvedValueOnce(null);

  await expect(
    service.removeFamilyMember('vc-1', 'nonexistent', 'user-1'),
  ).rejects.toThrow(NotFoundException);
}

async function runRemoveFamilyMemberCaseMissing(
  getContext: ContextAccessor,
): Promise<void> {
  const { service, visaCaseRepo } = getContext();
  visaCaseRepo.findOne.mockResolvedValueOnce(null);

  await expect(
    service.removeFamilyMember('nonexistent', 'fm-1', 'user-1'),
  ).rejects.toThrow(NotFoundException);
}
