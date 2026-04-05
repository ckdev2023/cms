import { BadRequestException, NotFoundException } from '@nestjs/common';

import {
  MaterialStatus,
  VisaCaseMemberRole,
  VisaCaseStatus,
} from '../../common/constants/enums';
import type {
  ContextAccessor,
  CustomerRepoMock,
} from './visa-case.service.spec-helpers';
import {
  buildInternalPrimaryCreatePayload,
  buildInternalPrimaryVisaCaseRecord,
  buildVisaCaseRecord,
  createQueryBuilderMock,
  PRIMARY_CUSTOMER,
} from './visa-case.service.spec-helpers';

export function registerCreateTests(getContext: ContextAccessor): void {
  describe('create', () => {
    it('should create a minimal visa case with DRAFT status', async () => {
      const { service, visaCaseRepo } = getContext();
      const savedEntity = buildVisaCaseRecord({
        id: 'vc-new',
        creator: { displayName: 'テスト管理者' },
      });

      visaCaseRepo.save.mockResolvedValue(savedEntity);
      visaCaseRepo.findOne.mockResolvedValue(savedEntity);

      const result = await service.create(
        'cust-1',
        { customerId: 'cust-1' },
        'user-1',
      );

      expect(result.id).toBe('vc-new');
      expect(result.caseStatus).toBe(VisaCaseStatus.DRAFT);
      expect(result.creatorName).toBe('テスト管理者');
    });

    it('should throw NotFoundException when customer does not exist', async () => {
      const { service, customerRepo } = getContext();
      customerRepo.count.mockResolvedValue(0);

      await expect(
        service.create('nonexistent', { customerId: 'nonexistent' }, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not create family member for non-family cases', async () => {
      const { service, visaCaseRepo, familyMemberRepo } = getContext();
      const savedEntity = buildVisaCaseRecord({ id: 'vc-new' });

      visaCaseRepo.save.mockResolvedValue(savedEntity);
      visaCaseRepo.findOne.mockResolvedValue(savedEntity);

      await service.create('cust-1', { customerId: 'cust-1' }, 'user-1');

      expect(familyMemberRepo.save).not.toHaveBeenCalled();
    });
  });
}

export function registerInternalPrimaryCreateTests(
  getContext: ContextAccessor,
): void {
  describe('create - INTERNAL primary applicant', () => {
    it('should auto-create primary family member for INTERNAL case', async () => {
      const { service, visaCaseRepo, familyMemberRepo, customerRepo } =
        getContext();
      const savedEntity = buildInternalPrimaryVisaCaseRecord(
        'cust-primary',
        '田中太郎',
        { id: 'vc-new' },
      );

      visaCaseRepo.save.mockResolvedValue({ ...savedEntity, id: 'vc-new' });
      visaCaseRepo.findOne.mockResolvedValue(savedEntity);
      customerRepo.findOne.mockResolvedValue(PRIMARY_CUSTOMER);

      const result = await service.create(
        'cust-1',
        buildInternalPrimaryCreatePayload(),
        'user-1',
      );

      expect(familyMemberRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          visaCaseId: 'vc-new',
          customerId: 'cust-primary',
          memberRole: VisaCaseMemberRole.APPLICANT,
          isPrimary: true,
        }),
      );
      expect(result.familyMembers).toHaveLength(1);
      expect(result.familyMembers[0].isPrimary).toBe(true);
    });

    it.each([
      {
        name: 'when INTERNAL mode has no primary customer ID',
        payload: buildInternalPrimaryCreatePayload({
          internalPrimaryCustomerId: undefined,
        }),
        setup: undefined,
        expectedError: BadRequestException,
      },
      {
        name: 'when INTERNAL primary customer is missing',
        payload: buildInternalPrimaryCreatePayload({
          internalPrimaryCustomerId: 'nonexistent',
        }),
        setup: (customerRepo: CustomerRepoMock) =>
          customerRepo.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0),
        expectedError: NotFoundException,
      },
    ])('should reject $name', async ({ payload, setup, expectedError }) => {
      const { service, customerRepo } = getContext();
      setup?.(customerRepo);

      await expect(service.create('cust-1', payload, 'user-1')).rejects.toThrow(
        expectedError,
      );
    });
  });
}

export function registerFindByCustomerTests(getContext: ContextAccessor): void {
  describe('findByCustomer', () => {
    it('should return paginated results with family members', async () => {
      const { service, visaCaseRepo } = getContext();
      const mockCase = buildVisaCaseRecord({
        caseType: '技術・人文知識・国際業務',
      });
      const qb = createQueryBuilderMock([[mockCase], 1]);

      visaCaseRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findByCustomer(
        'cust-1',
        {
          page: 1,
          pageSize: 20,
        },
        'user-1',
      );

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.items[0].caseType).toBe('技術・人文知識・国際業務');
      expect(result.items[0].familyMembers).toEqual([]);
    });

    it('should throw NotFoundException when customer does not exist', async () => {
      const { service, customerRepo } = getContext();
      customerRepo.count.mockResolvedValue(0);

      await expect(
        service.findByCustomer(
          'nonexistent',
          { page: 1, pageSize: 20 },
          'user-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it.each([
      {
        name: 'caseStatus',
        query: { page: 1, pageSize: 20, caseStatus: VisaCaseStatus.SUBMITTED },
        expectedClause: 'vc.caseStatus = :caseStatus',
        expectedParams: { caseStatus: VisaCaseStatus.SUBMITTED },
      },
      {
        name: 'materialStatus',
        query: {
          page: 1,
          pageSize: 20,
          materialStatus: MaterialStatus.PARTIAL,
        },
        expectedClause: 'vc.materialStatus = :materialStatus',
        expectedParams: { materialStatus: MaterialStatus.PARTIAL },
      },
    ])(
      'should apply $name filter',
      async ({ query, expectedClause, expectedParams }) => {
        const { service, visaCaseRepo } = getContext();
        const qb = createQueryBuilderMock([[], 0]);

        visaCaseRepo.createQueryBuilder.mockReturnValue(qb);

        await service.findByCustomer('cust-1', query, 'user-1');

        expect(qb.andWhere).toHaveBeenCalledWith(
          expectedClause,
          expectedParams,
        );
      },
    );
  });
}

export function registerFindOneTests(getContext: ContextAccessor): void {
  describe('findOne', () => {
    it('should return visa case detail with family members', async () => {
      const { service, visaCaseRepo } = getContext();
      const mockCase = buildInternalPrimaryVisaCaseRecord();

      visaCaseRepo.findOne.mockResolvedValue(mockCase);

      const result = await service.findOne('vc-1', 'user-1');

      expect(result.id).toBe('vc-1');
      expect(result.internalPrimaryCustomerId).toBe('cust-primary');
      expect(result.internalPrimaryCustomerName).toBe('田中太郎');
      expect(result.familyMembers).toHaveLength(1);
      expect(result.familyMembers[0].isPrimary).toBe(true);
      expect(result.familyMembers[0].customerName).toBe('田中太郎');
      expect(visaCaseRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'vc-1' },
        relations: [
          'assignee',
          'creator',
          'internalPrimaryCustomer',
          'familyMembers',
          'familyMembers.customer',
        ],
      });
    });

    it('should throw NotFoundException for non-existent case', async () => {
      const { service, visaCaseRepo } = getContext();
      visaCaseRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('nonexistent', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
}

export function registerUpdateTests(getContext: ContextAccessor): void {
  describe('update', () => {
    it('should update visa case fields', async () => {
      const { service, visaCaseRepo } = getContext();
      const existing = buildVisaCaseRecord();
      const updated = buildVisaCaseRecord({
        caseStatus: VisaCaseStatus.IN_PROGRESS,
      });

      visaCaseRepo.findOne
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(updated);

      const result = await service.update(
        'vc-1',
        { caseStatus: VisaCaseStatus.IN_PROGRESS },
        'user-2',
      );

      expect(result.caseStatus).toBe(VisaCaseStatus.IN_PROGRESS);
    });

    it('should throw NotFoundException for non-existent case', async () => {
      const { service, visaCaseRepo } = getContext();
      visaCaseRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update(
          'nonexistent',
          { caseStatus: VisaCaseStatus.IN_PROGRESS },
          'user-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should ignore customerId in update payload', async () => {
      const { service, visaCaseRepo } = getContext();
      const existing = buildVisaCaseRecord();

      visaCaseRepo.findOne
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(existing);

      await service.update(
        'vc-1',
        { customerId: 'cust-999', memo: 'テスト' },
        'user-1',
      );

      expect(visaCaseRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ customerId: 'cust-1', memo: 'テスト' }),
      );
    });
  });
}
