/* eslint-disable max-lines-per-function -- describe 内完結モック */
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AdminCaseStatus, VisaCaseStatus } from '../../common/constants/enums';
import { AdminCase } from '../admin-case/entities/admin-case.entity';
import { LogService } from '../log/log.service';
import {
  AdminCaseVisaSupplementCommitOutcome,
  AdminCaseVisaSupplementErrorCode,
  AdminCaseVisaSupplementRowStatus,
} from './admin-case-visa-supplement.constants';
import { AdminCaseVisaSupplementService } from './admin-case-visa-supplement.service';
import { AdminCaseVisaSupplementBatch } from './entities/admin-case-visa-supplement-batch.entity';
import { VisaCase } from './entities/visa-case.entity';
import { VisaCaseService } from './visa-case.service';

describe('AdminCaseVisaSupplementService', () => {
  let service: AdminCaseVisaSupplementService;
  let adminCaseRepo: { findOne: jest.Mock };
  let visaCaseRepo: { findOne: jest.Mock };
  let batchRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let visaCaseService: jest.Mocked<Pick<VisaCaseService, 'create'>>;
  let auditLogService: jest.Mocked<Pick<LogService, 'createAuditLog'>>;

  const customerId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const adminCaseId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  const adminEntity = (): AdminCase =>
    ({
      id: adminCaseId,
      customerId,
      caseName: '行政テスト',
      applicantName: '山田',
      residenceStatus: '技術',
      status: AdminCaseStatus.ACCEPTED,
      expireDate: new Date('2027-01-15T00:00:00.000Z'),
      ownerUserId: null,
    }) as AdminCase;

  beforeEach(async () => {
    adminCaseRepo = { findOne: jest.fn() };
    visaCaseRepo = { findOne: jest.fn() };
    batchRepo = {
      findOne: jest.fn(),
      create: jest.fn((x: unknown) => x),
      save: jest.fn(),
    };
    visaCaseService = { create: jest.fn() };
    auditLogService = { createAuditLog: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AdminCaseVisaSupplementService,
        { provide: VisaCaseService, useValue: visaCaseService },
        { provide: LogService, useValue: auditLogService },
        { provide: getRepositoryToken(AdminCase), useValue: adminCaseRepo },
        { provide: getRepositoryToken(VisaCase), useValue: visaCaseRepo },
        {
          provide: getRepositoryToken(AdminCaseVisaSupplementBatch),
          useValue: batchRepo,
        },
      ],
    }).compile();

    service = moduleRef.get(AdminCaseVisaSupplementService);
  });

  it('preview marks ERROR when admin case missing', async () => {
    adminCaseRepo.findOne.mockResolvedValue(null);
    const r = await service.preview([adminCaseId]);
    expect(r.rows[0].status).toBe(AdminCaseVisaSupplementRowStatus.ERROR);
    expect(r.rows[0].errors[0].code).toBe(
      AdminCaseVisaSupplementErrorCode.ADMIN_CASE_NOT_FOUND,
    );
    expect(r.summary.canProceed).toBe(false);
  });

  it('preview marks DUPLICATE_SKIPPED when visa import_reference exists', async () => {
    adminCaseRepo.findOne.mockResolvedValue(adminEntity());
    visaCaseRepo.findOne.mockResolvedValue({ id: 'vc-existing' });
    const r = await service.preview([adminCaseId]);
    expect(r.rows[0].status).toBe(
      AdminCaseVisaSupplementRowStatus.DUPLICATE_SKIPPED,
    );
    expect(r.rows[0].existingVisaCaseId).toBe('vc-existing');
    expect(r.summary.canProceed).toBe(true);
  });

  it('preview OK maps weak admin status with warning', async () => {
    adminCaseRepo.findOne.mockResolvedValue(adminEntity());
    visaCaseRepo.findOne.mockResolvedValue(null);
    const r = await service.preview([adminCaseId]);
    expect(r.rows[0].status).toBe(AdminCaseVisaSupplementRowStatus.OK);
    expect(r.rows[0].warnings.length).toBeGreaterThan(0);
    expect(r.rows[0].proposed?.caseStatus).toBe(VisaCaseStatus.IN_PROGRESS);
    expect(r.summary.canProceed).toBe(true);
  });

  it('commit throws BadRequest when preview has errors', async () => {
    adminCaseRepo.findOne.mockResolvedValue(null);
    await expect(
      service.commit([adminCaseId], 'user-1', null, null),
    ).rejects.toThrow(BadRequestException);
  });

  it('commit throws Conflict when batch sha already exists', async () => {
    adminCaseRepo.findOne.mockResolvedValue(adminEntity());
    visaCaseRepo.findOne.mockResolvedValue(null);
    batchRepo.findOne.mockResolvedValue({
      id: 'old-batch',
      contentSha256: 'x',
    });
    await expect(
      service.commit([adminCaseId], 'user-1', null, null),
    ).rejects.toThrow(ConflictException);
  });

  it('commit creates visa case, persists batch and audits', async () => {
    adminCaseRepo.findOne.mockResolvedValue(adminEntity());
    visaCaseRepo.findOne.mockResolvedValue(null);
    batchRepo.findOne.mockResolvedValue(null);
    visaCaseService.create.mockResolvedValue({ id: 'new-vc' } as never);
    batchRepo.save.mockImplementation((x: AdminCaseVisaSupplementBatch) =>
      Promise.resolve({ ...x, id: 'supp-batch-1' }),
    );

    const r = await service.commit(
      [adminCaseId],
      'user-1',
      '127.0.0.1',
      'jest',
    );

    expect(r.supplementBatchId).toBe('supp-batch-1');
    expect(r.rows[0].outcome).toBe(
      AdminCaseVisaSupplementCommitOutcome.CASE_CREATED,
    );
    expect(visaCaseService.create).toHaveBeenCalled();
    expect(auditLogService.createAuditLog).toHaveBeenCalled();
  });
});
