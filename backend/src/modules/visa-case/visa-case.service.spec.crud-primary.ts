import { BadRequestException } from '@nestjs/common';

import { FamilyLinkMode, FamilyRelation } from '../../common/constants/enums';
import type { ContextAccessor } from './visa-case.service.spec-helpers';
import {
  buildExternalPrimaryCreatePayload,
  buildExternalPrimaryVisaCaseRecord,
  buildInternalFamilyCaseWithoutMembers,
  buildInternalPrimaryVisaCaseRecord,
  buildPrimaryApplicantMember,
  buildVisaCaseRecord,
  UPDATED_PRIMARY_CUSTOMER,
} from './visa-case.service.spec-helpers';

export function registerExternalPrimaryCreateTests(
  getContext: ContextAccessor,
): void {
  describe('create - EXTERNAL primary applicant', () => {
    it('should create case with external primary snapshot fields', async () => {
      const { service, visaCaseRepo } = getContext();
      const savedEntity = buildExternalPrimaryVisaCaseRecord(
        '外部太郎',
        '技術・人文知識・国際業務',
        '2027-06-30',
        {
          id: 'vc-new',
          externalPrimaryRelationToApplicant: FamilyRelation.SPOUSE,
        },
      );

      visaCaseRepo.save.mockResolvedValue({ ...savedEntity, id: 'vc-new' });
      visaCaseRepo.findOne.mockResolvedValue(savedEntity);

      const result = await service.create(
        'cust-1',
        buildExternalPrimaryCreatePayload({
          externalPrimaryCaseType: '技術・人文知識・国際業務',
          externalPrimaryExpireDate: '2027-06-30',
          externalPrimaryRelationToApplicant: FamilyRelation.SPOUSE,
        }),
        'user-1',
      );

      expect(result.externalPrimaryName).toBe('外部太郎');
      expect(result.externalPrimaryCaseType).toBe('技術・人文知識・国際業務');
      expect(result.externalPrimaryExpireDate).toBe('2027-06-30');
      expect(result.externalPrimaryRelationToApplicant).toBe(
        FamilyRelation.SPOUSE,
      );
    });

    it('should not create family member for EXTERNAL case', async () => {
      const { service, visaCaseRepo, familyMemberRepo } = getContext();
      const savedEntity = buildExternalPrimaryVisaCaseRecord(
        '外部太郎',
        null,
        null,
        {
          id: 'vc-new',
        },
      );

      visaCaseRepo.save.mockResolvedValue({ ...savedEntity, id: 'vc-new' });
      visaCaseRepo.findOne.mockResolvedValue(savedEntity);

      await service.create(
        'cust-1',
        buildExternalPrimaryCreatePayload(),
        'user-1',
      );

      expect(familyMemberRepo.save).not.toHaveBeenCalled();
    });

    it('should reject EXTERNAL case without primary name', async () => {
      const { service } = getContext();

      await expect(
        service.create(
          'cust-1',
          buildExternalPrimaryCreatePayload({ externalPrimaryName: undefined }),
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
}

export function registerExternalPrimaryUpdateTests(
  getContext: ContextAccessor,
): void {
  describe('update - EXTERNAL primary applicant', () => {
    it('should update external primary snapshot fields', async () => {
      const { service, visaCaseRepo } = getContext();
      const existing = buildExternalPrimaryVisaCaseRecord('外部太郎');
      const updated = buildExternalPrimaryVisaCaseRecord(
        '外部花子',
        '経営・管理',
        '2028-12-31',
        { externalPrimaryRelationToApplicant: FamilyRelation.CHILD },
      );

      visaCaseRepo.findOne
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(updated);

      const result = await service.update(
        'vc-1',
        {
          externalPrimaryName: '外部花子',
          externalPrimaryCaseType: '経営・管理',
          externalPrimaryExpireDate: '2028-12-31',
          externalPrimaryRelationToApplicant: FamilyRelation.CHILD,
        },
        'user-1',
      );

      expect(result.externalPrimaryName).toBe('外部花子');
      expect(result.externalPrimaryCaseType).toBe('経営・管理');
      expect(result.externalPrimaryRelationToApplicant).toBe(
        FamilyRelation.CHILD,
      );
    });

    it('should clear internal fields and remove primary member when switching to EXTERNAL', async () => {
      const { service, visaCaseRepo, familyMemberRepo } = getContext();
      const existing = buildVisaCaseRecord({
        isFamilyCase: true,
        familyLinkMode: FamilyLinkMode.INTERNAL,
        internalPrimaryCustomerId: 'cust-primary',
        familyMembers: [],
      });
      const updated = buildExternalPrimaryVisaCaseRecord('外部太郎');

      familyMemberRepo.findOne.mockResolvedValue({
        id: 'fm-1',
        customerId: 'cust-primary',
        isPrimary: true,
      });
      visaCaseRepo.findOne
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(updated);

      const result = await service.update(
        'vc-1',
        {
          familyLinkMode: FamilyLinkMode.EXTERNAL,
          externalPrimaryName: '外部太郎',
        },
        'user-1',
      );

      expect(familyMemberRepo.remove).toHaveBeenCalled();
      expect(result.externalPrimaryName).toBe('外部太郎');
      expect(result.internalPrimaryCustomerId).toBeNull();
    });
  });
}

export function registerInternalPrimaryUpdateTests(
  getContext: ContextAccessor,
): void {
  describe('update - INTERNAL primary applicant sync', () => {
    it('should reject switching to INTERNAL without primary ID', async () => {
      const { service, visaCaseRepo } = getContext();
      const existing = buildVisaCaseRecord({ familyMembers: [] });
      visaCaseRepo.findOne.mockResolvedValueOnce(existing);

      await expect(
        service.update(
          'vc-1',
          { isFamilyCase: true, familyLinkMode: FamilyLinkMode.INTERNAL },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should sync primary member when changing primary customer', async () => {
      const { service, visaCaseRepo, familyMemberRepo, customerRepo } =
        getContext();
      const existing = buildInternalFamilyCaseWithoutMembers('cust-old');
      const updated = buildInternalPrimaryVisaCaseRecord(
        'cust-new',
        '山田花子',
        {
          familyMembers: [
            buildPrimaryApplicantMember({
              id: 'fm-2',
              customerId: 'cust-new',
              customer: { customerName: '山田花子' },
              displayNameSnapshot: '山田花子',
            }),
          ],
        },
      );

      familyMemberRepo.findOne.mockResolvedValue({
        id: 'fm-old',
        customerId: 'cust-old',
        isPrimary: true,
      });
      customerRepo.findOne.mockResolvedValue(UPDATED_PRIMARY_CUSTOMER);
      visaCaseRepo.findOne
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(updated);

      const result = await service.update(
        'vc-1',
        { internalPrimaryCustomerId: 'cust-new' },
        'user-1',
      );

      expect(familyMemberRepo.remove).toHaveBeenCalled();
      expect(result.internalPrimaryCustomerName).toBe('山田花子');
    });

    it('should skip sync when primary customer unchanged', async () => {
      const { service, visaCaseRepo, familyMemberRepo } = getContext();
      const existing = buildInternalFamilyCaseWithoutMembers();
      const updated = buildInternalPrimaryVisaCaseRecord();

      familyMemberRepo.findOne.mockResolvedValue({
        id: 'fm-1',
        customerId: 'cust-primary',
        isPrimary: true,
      });
      visaCaseRepo.findOne
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(updated);

      await service.update('vc-1', { memo: '変更なし' }, 'user-1');

      expect(familyMemberRepo.remove).not.toHaveBeenCalled();
    });
  });
}
