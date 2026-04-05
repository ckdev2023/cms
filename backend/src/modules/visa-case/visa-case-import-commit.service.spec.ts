/* eslint-disable max-lines, max-lines-per-function -- 导入提交与幂等场景用例集中 */
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError } from 'typeorm';

import {
  AuditActionType,
  AuditTargetType,
  FamilyLinkMode,
  FamilyRelation,
  OperationResult,
  VisaCaseMemberRole,
  VisaCaseStatus,
} from '../../common/constants/enums';
import { LogService } from '../log/log.service';
import { VisaCase } from './entities/visa-case.entity';
import { VisaCaseImportBatch } from './entities/visa-case-import-batch.entity';
import {
  VisaCaseImportCommitErrorCode,
  VisaCaseImportCommitOutcome,
  VisaCaseImportRowStatus,
} from './import/visa-case-import.constants';
import { VisaCaseService } from './visa-case.service';
import { VisaCaseFamilyMemberService } from './visa-case-family-member.service';
import { VisaCaseFilePathService } from './visa-case-file-path.service';
import { VisaCaseImportCommitService } from './visa-case-import-commit.service';
import type {
  VisaCaseImportPreviewResultDto,
  VisaCaseImportPreviewRowDto,
} from './visa-case-import-preview.service';
import { VisaCaseImportPreviewService } from './visa-case-import-preview.service';
import { VisaCaseLogService } from './visa-case-log.service';

describe('VisaCaseImportCommitService', () => {
  let service: VisaCaseImportCommitService;
  let preview: jest.Mocked<
    Pick<VisaCaseImportPreviewService, 'previewFromBuffer'>
  >;
  let visaCaseService: jest.Mocked<Pick<VisaCaseService, 'create'>>;
  let familyMemberService: jest.Mocked<
    Pick<VisaCaseFamilyMemberService, 'addFamilyMember'>
  >;
  let batchRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let visaCaseRepo: { findOne: jest.Mock };
  let auditLogService: jest.Mocked<Pick<LogService, 'createAuditLog'>>;

  const cid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  /** PostgreSQL unique_violation — 用于模拟创建案件时撞 `(customer_id, import_reference)`。 */
  const pgUniqueViolation = (): QueryFailedError => {
    const err = new QueryFailedError(
      'INSERT visa_cases',
      [],
      new Error('duplicate key'),
    );
    const driverError = new Error('23505') as Error & { code: string };
    driverError.code = '23505';
    (
      err as QueryFailedError & { driverError?: Error & { code?: string } }
    ).driverError = driverError;
    return err;
  };

  const minimalOkPreview = (): VisaCaseImportPreviewResultDto => ({
    dryRun: true,
    contentSha256: 'deadbeef',
    blockingFileErrors: [],
    summary: {
      rowCount: 1,
      okRowCount: 1,
      errorRowCount: 0,
      warningRowCount: 0,
      duplicateSkippedRowCount: 0,
      canProceed: true,
    },
    rows: [
      {
        rowNumber: 2,
        recordType: 'CASE',
        status: 'OK',
        errors: [],
        warnings: [],
        resolved: {
          serviceCustomerId: cid,
          legacyCaseRef: null,
          case: {
            isFamilyCase: false,
            familyLinkMode: null,
            internalPrimaryCustomerId: null,
            externalPrimaryName: null,
            externalPrimaryCaseType: null,
            externalPrimaryExpireDate: null,
            externalPrimaryRelationToApplicant: null,
            caseType: null,
            caseStatus: VisaCaseStatus.DRAFT,
            expireDate: null,
            nextFollowUpAt: null,
            materialStatus: null,
            feeStatus: null,
            memo: null,
            assignedTo: null,
          },
        },
      },
    ],
  });

  /** 模拟 DB 写入后的 `created_at`，与 `VisaCaseImportBatch` 实体一致。 */
  const stubBatchCommittedAt = new Date('2026-04-04T12:00:00.000Z');

  /**
   * 模拟 `batchRepo.save` 返回值，补齐 `id` 与 `createdAt`（真实库由列默认填充）。
   *
   * @param entity - create 传入的批次实体
   * @param id - 模拟生成的主键
   * @returns 与 TypeORM save 解析结果同形的 Promise
   */
  function mockSaveResolvedBatch(
    entity: VisaCaseImportBatch,
    id: string,
  ): Promise<VisaCaseImportBatch> {
    return Promise.resolve({
      ...entity,
      id,
      createdAt: stubBatchCommittedAt,
    });
  }

  beforeEach(async () => {
    preview = { previewFromBuffer: jest.fn() };
    visaCaseService = { create: jest.fn() };
    visaCaseRepo = { findOne: jest.fn() };
    familyMemberService = { addFamilyMember: jest.fn() };
    batchRepo = {
      findOne: jest.fn(),
      create: jest.fn((x: unknown) => x),
      save: jest.fn(),
    };
    auditLogService = { createAuditLog: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        VisaCaseImportCommitService,
        { provide: VisaCaseImportPreviewService, useValue: preview },
        { provide: VisaCaseService, useValue: visaCaseService },
        {
          provide: getRepositoryToken(VisaCaseImportBatch),
          useValue: batchRepo,
        },
        {
          provide: getRepositoryToken(VisaCase),
          useValue: visaCaseRepo,
        },
        {
          provide: VisaCaseFamilyMemberService,
          useValue: familyMemberService,
        },
        {
          provide: VisaCaseFilePathService,
          useValue: { createFilePath: jest.fn() },
        },
        {
          provide: VisaCaseLogService,
          useValue: { createLog: jest.fn() },
        },
        { provide: LogService, useValue: auditLogService },
      ],
    }).compile();

    service = moduleRef.get(VisaCaseImportCommitService);
  });

  it('throws BadRequest when preview canProceed is false', async () => {
    const base = minimalOkPreview();
    preview.previewFromBuffer.mockResolvedValue({
      ...base,
      summary: {
        ...base.summary,
        canProceed: false,
        errorRowCount: 1,
      },
    });
    await expect(
      service.commitFromBuffer(Buffer.from('x'), 'user-1', null, null, null),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws Conflict when batch already exists for sha256 (docs/24 §7.1 CSV_ALREADY_IMPORTED)', async () => {
    preview.previewFromBuffer.mockResolvedValue(minimalOkPreview());
    batchRepo.findOne.mockResolvedValue({
      id: 'prior-batch',
      contentSha256: 'deadbeef',
    });
    await expect(
      service.commitFromBuffer(Buffer.from('x'), 'user-1', null, null, null),
    ).rejects.toMatchObject({
      constructor: ConflictException,
      message: expect.stringContaining(
        VisaCaseImportCommitErrorCode.CSV_ALREADY_IMPORTED,
      ) as string,
    });
  });

  it('throws Conflict with CSV_ALREADY_IMPORTED when batch save hits unique on content_sha256 (race)', async () => {
    preview.previewFromBuffer.mockResolvedValue(minimalOkPreview());
    batchRepo.findOne.mockResolvedValue(null);
    visaCaseService.create.mockResolvedValue({ id: 'new-case-id' } as never);
    batchRepo.save.mockRejectedValue(pgUniqueViolation());

    await expect(
      service.commitFromBuffer(Buffer.from('x'), 'user-1', null, null, null),
    ).rejects.toMatchObject({
      constructor: ConflictException,
      message: expect.stringContaining(
        VisaCaseImportCommitErrorCode.CSV_ALREADY_IMPORTED,
      ) as string,
    });
  });

  it('creates case, saves batch and writes audit log', async () => {
    preview.previewFromBuffer.mockResolvedValue(minimalOkPreview());
    batchRepo.findOne.mockResolvedValue(null);
    visaCaseService.create.mockResolvedValue({ id: 'new-case-id' } as never);
    batchRepo.save.mockImplementation((x: VisaCaseImportBatch) =>
      mockSaveResolvedBatch(x, 'batch-id-1'),
    );

    const r = await service.commitFromBuffer(
      Buffer.from('x'),
      'user-1',
      'hist.csv',
      '1.2.3.4',
      'jest',
    );

    expect(r.importBatchId).toBe('batch-id-1');
    expect(r.rows[0].outcome).toBe(VisaCaseImportCommitOutcome.CASE_CREATED);
    expect(visaCaseService.create).toHaveBeenCalled();
    expect(auditLogService.createAuditLog).toHaveBeenCalled();
  });

  it('forwards externalPrimaryRelationToApplicant when preview CASE is EXTERNAL family', async () => {
    preview.previewFromBuffer.mockResolvedValue({
      ...minimalOkPreview(),
      rows: [
        {
          rowNumber: 2,
          recordType: 'CASE',
          status: 'OK',
          errors: [],
          warnings: [],
          resolved: {
            serviceCustomerId: cid,
            legacyCaseRef: null,
            case: {
              isFamilyCase: true,
              familyLinkMode: FamilyLinkMode.EXTERNAL,
              internalPrimaryCustomerId: null,
              externalPrimaryName: '主申名',
              externalPrimaryCaseType: null,
              externalPrimaryExpireDate: null,
              externalPrimaryRelationToApplicant: FamilyRelation.SPOUSE,
              caseType: null,
              caseStatus: VisaCaseStatus.DRAFT,
              expireDate: null,
              nextFollowUpAt: null,
              materialStatus: null,
              feeStatus: null,
              memo: null,
              assignedTo: null,
            },
          },
        },
      ],
    });
    batchRepo.findOne.mockResolvedValue(null);
    visaCaseService.create.mockResolvedValue({ id: 'vc-ext-rel' } as never);
    batchRepo.save.mockImplementation((x: VisaCaseImportBatch) =>
      mockSaveResolvedBatch(x, 'batch-ext-rel'),
    );

    await service.commitFromBuffer(
      Buffer.from('x'),
      'user-1',
      null,
      null,
      null,
    );

    expect(visaCaseService.create).toHaveBeenCalledWith(
      cid,
      expect.objectContaining({
        isFamilyCase: true,
        familyLinkMode: FamilyLinkMode.EXTERNAL,
        externalPrimaryName: '主申名',
        externalPrimaryRelationToApplicant: FamilyRelation.SPOUSE,
      }),
      'user-1',
    );
  });

  /**
   * docs/23 §6 / §6.4：`visa_case_import_batches` 与 `audit_logs` 在操作者、批次 ID、内容指纹与汇总上可对账。
   */
  it('persists batch row and audit log with aligned operator, batch id, and contentSha256 (docs/23 §6)', async () => {
    preview.previewFromBuffer.mockResolvedValue(minimalOkPreview());
    batchRepo.findOne.mockResolvedValue(null);
    visaCaseService.create.mockResolvedValue({ id: 'new-case-id' } as never);
    const savedBatchId = '11111111-1111-4111-8111-111111111111';
    batchRepo.save.mockImplementation((x: VisaCaseImportBatch) =>
      mockSaveResolvedBatch(x, savedBatchId),
    );

    const commitResult = await service.commitFromBuffer(
      Buffer.from('x'),
      'user-audit-uuid',
      'report.csv',
      '10.0.0.1',
      'jest-agent',
    );

    expect(commitResult.importBatchId).toBe(savedBatchId);
    expect(commitResult.createdBy).toBe('user-audit-uuid');
    expect(commitResult.createdAt).toBe(stubBatchCommittedAt.toISOString());

    expect(batchRepo.save).toHaveBeenCalledTimes(1);
    const saveCalls = batchRepo.save.mock
      .calls as unknown as VisaCaseImportBatch[][];
    const savedBatch = saveCalls[0]?.[0];
    expect(savedBatch).toBeDefined();
    expect(savedBatch.contentSha256).toBe('deadbeef');
    expect(savedBatch.createdBy).toBe('user-audit-uuid');
    expect(savedBatch.summary).toMatchObject({
      fileName: 'report.csv',
      rowCount: 1,
    });

    expect(auditLogService.createAuditLog).toHaveBeenCalledTimes(1);
    const auditPayload = auditLogService.createAuditLog.mock.calls[0]?.[0];
    expect(auditPayload).toMatchObject({
      userId: 'user-audit-uuid',
      actionType: AuditActionType.IMPORT,
      targetType: AuditTargetType.VISA_CASE_IMPORT,
      targetId: savedBatchId,
      ipAddress: '10.0.0.1',
      deviceInfo: 'jest-agent',
      result: OperationResult.SUCCESS,
    });
    expect(auditPayload?.afterValue).toMatchObject({
      importBatchId: savedBatchId,
      contentSha256: 'deadbeef',
      fileName: 'report.csv',
      rowCount: 1,
    });
  });

  /**
   * docs/23/24：同一 buffer 经 preview 校验后再逐行写入；`summary.rowCount` 与 `rows.length` 与预览行数一致。
   */
  describe('preview/commit batch contract (docs/24 §2–3)', () => {
    it('forwards the identical Buffer to previewFromBuffer exactly once', async () => {
      preview.previewFromBuffer.mockResolvedValue(minimalOkPreview());
      batchRepo.findOne.mockResolvedValue(null);
      visaCaseService.create.mockResolvedValue({ id: 'new-case-id' } as never);
      batchRepo.save.mockImplementation((x: VisaCaseImportBatch) =>
        mockSaveResolvedBatch(x, 'batch-id-1'),
      );

      const buf = Buffer.from('record_type,customer_id\nCASE,x\n', 'utf8');
      await service.commitFromBuffer(buf, 'user-1', null, null, null);

      expect(preview.previewFromBuffer).toHaveBeenCalledTimes(1);
      expect(preview.previewFromBuffer).toHaveBeenCalledWith(buf);
    });

    it('commit result rowCount and rows length match multi-row preview', async () => {
      const basePreview = minimalOkPreview();
      const rowA = basePreview.rows[0];
      if (!rowA?.resolved) {
        throw new Error('fixture row missing resolved');
      }
      const rowB = {
        ...rowA,
        rowNumber: 3,
        resolved: {
          ...rowA.resolved,
          legacyCaseRef: null,
        },
      };
      const multi: VisaCaseImportPreviewResultDto = {
        ...minimalOkPreview(),
        summary: {
          rowCount: 2,
          okRowCount: 2,
          errorRowCount: 0,
          warningRowCount: 0,
          duplicateSkippedRowCount: 0,
          canProceed: true,
        },
        rows: [rowA, rowB],
      };
      preview.previewFromBuffer.mockResolvedValue(multi);
      batchRepo.findOne.mockResolvedValue(null);
      visaCaseService.create
        .mockResolvedValueOnce({ id: 'case-a' } as never)
        .mockResolvedValueOnce({ id: 'case-b' } as never);
      batchRepo.save.mockImplementation((x: VisaCaseImportBatch) =>
        mockSaveResolvedBatch(x, 'batch-multi'),
      );

      const r = await service.commitFromBuffer(
        Buffer.from('csv'),
        'user-1',
        null,
        null,
        null,
      );

      expect(r.summary.rowCount).toBe(2);
      expect(r.rows).toHaveLength(2);
      expect(
        r.rows.every(
          (x) => x.outcome === VisaCaseImportCommitOutcome.CASE_CREATED,
        ),
      ).toBe(true);
    });
  });

  /**
   * docs/23 §1.1 / §9：文件内 legacy 重复阻断、库内 import_reference 跳过、同 SHA 409、创建撞唯一约束合流。
   */
  describe('idempotency and conflict (docs/23–24 story 9)', () => {
    it('DUPLICATE_SKIPPED CASE yields SKIPPED_DUPLICATE with visaCaseId from DB (§9 #7)', async () => {
      const legacy = 'LEG-IDEM-1';
      const existingId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
      const previewDto: VisaCaseImportPreviewResultDto = {
        dryRun: true,
        contentSha256: 'sha-dup-case',
        blockingFileErrors: [],
        summary: {
          rowCount: 1,
          okRowCount: 0,
          errorRowCount: 0,
          warningRowCount: 0,
          duplicateSkippedRowCount: 1,
          canProceed: true,
        },
        rows: [
          {
            rowNumber: 2,
            recordType: 'CASE',
            status: 'DUPLICATE_SKIPPED',
            errors: [],
            warnings: [],
            resolved: {
              serviceCustomerId: cid,
              legacyCaseRef: legacy,
              case: {
                isFamilyCase: false,
                familyLinkMode: null,
                internalPrimaryCustomerId: null,
                externalPrimaryName: null,
                externalPrimaryCaseType: null,
                externalPrimaryExpireDate: null,
                externalPrimaryRelationToApplicant: null,
                caseType: null,
                caseStatus: VisaCaseStatus.DRAFT,
                expireDate: null,
                nextFollowUpAt: null,
                materialStatus: null,
                feeStatus: null,
                memo: null,
                assignedTo: null,
              },
            },
          },
        ],
      };
      preview.previewFromBuffer.mockResolvedValue(previewDto);
      batchRepo.findOne.mockResolvedValue(null);
      visaCaseRepo.findOne.mockResolvedValue({ id: existingId } as VisaCase);
      batchRepo.save.mockImplementation((x: VisaCaseImportBatch) =>
        mockSaveResolvedBatch(x, 'batch-dup'),
      );

      const r = await service.commitFromBuffer(
        Buffer.from('x'),
        'user-1',
        null,
        null,
        null,
      );

      expect(visaCaseService.create).not.toHaveBeenCalled();
      expect(r.rows[0].outcome).toBe(
        VisaCaseImportCommitOutcome.SKIPPED_DUPLICATE,
      );
      expect(r.rows[0].visaCaseId).toBe(existingId);
      expect(r.summary.skippedDuplicateCaseCount).toBe(1);
    });

    it('FAMILY_MEMBER after SKIPPED_DUPLICATE CASE resolves visaCaseId from legacy map', async () => {
      const legacy = 'LEG-FAM-1';
      const existingId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
      const previewDto: VisaCaseImportPreviewResultDto = {
        dryRun: true,
        contentSha256: 'sha-fam',
        blockingFileErrors: [],
        summary: {
          rowCount: 2,
          okRowCount: 1,
          errorRowCount: 0,
          warningRowCount: 0,
          duplicateSkippedRowCount: 1,
          canProceed: true,
        },
        rows: [
          {
            rowNumber: 2,
            recordType: 'CASE',
            status: 'DUPLICATE_SKIPPED',
            errors: [],
            warnings: [],
            resolved: {
              serviceCustomerId: cid,
              legacyCaseRef: legacy,
              case: {
                isFamilyCase: false,
                familyLinkMode: null,
                internalPrimaryCustomerId: null,
                externalPrimaryName: null,
                externalPrimaryCaseType: null,
                externalPrimaryExpireDate: null,
                externalPrimaryRelationToApplicant: null,
                caseType: null,
                caseStatus: VisaCaseStatus.DRAFT,
                expireDate: null,
                nextFollowUpAt: null,
                materialStatus: null,
                feeStatus: null,
                memo: null,
                assignedTo: null,
              },
            },
          },
          {
            rowNumber: 3,
            recordType: 'FAMILY_MEMBER',
            status: 'OK',
            errors: [],
            warnings: [],
            resolved: {
              serviceCustomerId: cid,
              legacyCaseRef: legacy,
              familyMember: {
                memberCustomerId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
                memberRole: VisaCaseMemberRole.SPOUSE,
                isPrimary: false,
                displayNameSnapshot: '配偶',
              },
            },
          },
        ],
      };
      preview.previewFromBuffer.mockResolvedValue(previewDto);
      batchRepo.findOne.mockResolvedValue(null);
      visaCaseRepo.findOne.mockResolvedValue({ id: existingId } as VisaCase);
      familyMemberService.addFamilyMember.mockResolvedValue({
        id: 'mem-1',
      } as never);
      batchRepo.save.mockImplementation((x: VisaCaseImportBatch) =>
        mockSaveResolvedBatch(x, 'batch-fam'),
      );

      const r = await service.commitFromBuffer(
        Buffer.from('x'),
        'user-1',
        null,
        null,
        null,
      );

      expect(familyMemberService.addFamilyMember).toHaveBeenCalledWith(
        existingId,
        expect.any(Object),
      );
      expect(r.rows[1].outcome).toBe(VisaCaseImportCommitOutcome.MEMBER_ADDED);
      expect(r.rows[1].visaCaseId).toBe(existingId);
    });

    it('create throws unique violation on import_reference then SKIPPED_DUPLICATE with existing row', async () => {
      const legacy = 'LEG-RACE-1';
      const existingId = '99999999-9999-4999-8999-999999999999';
      const baseRow = minimalOkPreview().rows[0];
      if (!baseRow?.resolved) {
        throw new Error('fixture row missing resolved');
      }
      const row = {
        ...baseRow,
        resolved: { ...baseRow.resolved, legacyCaseRef: legacy },
      };
      const previewDto: VisaCaseImportPreviewResultDto = {
        ...minimalOkPreview(),
        contentSha256: 'sha-race',
        rows: [row],
      };
      preview.previewFromBuffer.mockResolvedValue(previewDto);
      batchRepo.findOne.mockResolvedValue(null);
      visaCaseService.create.mockRejectedValue(pgUniqueViolation());
      visaCaseRepo.findOne.mockResolvedValue({ id: existingId } as VisaCase);
      batchRepo.save.mockImplementation((x: VisaCaseImportBatch) =>
        mockSaveResolvedBatch(x, 'batch-race'),
      );

      const r = await service.commitFromBuffer(
        Buffer.from('x'),
        'user-1',
        null,
        null,
        null,
      );

      expect(r.rows[0].outcome).toBe(
        VisaCaseImportCommitOutcome.SKIPPED_DUPLICATE,
      );
      expect(r.rows[0].visaCaseId).toBe(existingId);
    });

    it('does not commit when preview canProceed false even if rows mix OK and ERROR', async () => {
      const rowOk = minimalOkPreview().rows[0];
      if (!rowOk) {
        throw new Error('fixture row missing');
      }
      const rowErr: VisaCaseImportPreviewRowDto = {
        rowNumber: 3,
        recordType: 'CASE',
        status: VisaCaseImportRowStatus.ERROR,
        errors: [{ code: 'CUSTOMER_NOT_FOUND', message: 'x' }],
        warnings: [],
      };
      const previewDto: VisaCaseImportPreviewResultDto = {
        ...minimalOkPreview(),
        summary: {
          rowCount: 2,
          okRowCount: 1,
          errorRowCount: 1,
          warningRowCount: 0,
          duplicateSkippedRowCount: 0,
          canProceed: false,
        },
        rows: [rowOk, rowErr],
      };
      preview.previewFromBuffer.mockResolvedValue(previewDto);

      await expect(
        service.commitFromBuffer(Buffer.from('x'), 'u', null, null, null),
      ).rejects.toThrow(BadRequestException);
      expect(batchRepo.save).not.toHaveBeenCalled();
    });

    /**
     * docs/24 §1.2 / §9 #11：提交阶段运行时失败不回滚已成功行。
     */
    it('runtime error on FAMILY_MEMBER after CASE_CREATED still saves batch with failedRowCount', async () => {
      const legacy = 'LEG-RUNTIME-1';
      const resolvedCase = {
        isFamilyCase: false,
        familyLinkMode: null,
        internalPrimaryCustomerId: null,
        externalPrimaryName: null,
        externalPrimaryCaseType: null,
        externalPrimaryExpireDate: null,
        externalPrimaryRelationToApplicant: null,
        caseType: null,
        caseStatus: VisaCaseStatus.DRAFT,
        expireDate: null,
        nextFollowUpAt: null,
        materialStatus: null,
        feeStatus: null,
        memo: null,
        assignedTo: null,
      };
      const previewDto: VisaCaseImportPreviewResultDto = {
        dryRun: true,
        contentSha256: 'sha-runtime',
        blockingFileErrors: [],
        summary: {
          rowCount: 2,
          okRowCount: 2,
          errorRowCount: 0,
          warningRowCount: 0,
          duplicateSkippedRowCount: 0,
          canProceed: true,
        },
        rows: [
          {
            rowNumber: 2,
            recordType: 'CASE',
            status: 'OK',
            errors: [],
            warnings: [],
            resolved: {
              serviceCustomerId: cid,
              legacyCaseRef: legacy,
              case: resolvedCase,
            },
          },
          {
            rowNumber: 3,
            recordType: 'FAMILY_MEMBER',
            status: 'OK',
            errors: [],
            warnings: [],
            resolved: {
              serviceCustomerId: cid,
              legacyCaseRef: legacy,
              familyMember: {
                memberCustomerId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
                memberRole: VisaCaseMemberRole.SPOUSE,
                isPrimary: false,
                displayNameSnapshot: '配偶',
              },
            },
          },
        ],
      };
      preview.previewFromBuffer.mockResolvedValue(previewDto);
      batchRepo.findOne.mockResolvedValue(null);
      visaCaseService.create.mockResolvedValue({ id: 'new-case-run' } as never);
      familyMemberService.addFamilyMember.mockRejectedValue(
        new Error('db constraint'),
      );
      batchRepo.save.mockImplementation((x: VisaCaseImportBatch) =>
        mockSaveResolvedBatch(x, 'batch-runtime'),
      );

      const r = await service.commitFromBuffer(
        Buffer.from('x'),
        'user-1',
        null,
        null,
        null,
      );

      expect(r.rows[0].outcome).toBe(VisaCaseImportCommitOutcome.CASE_CREATED);
      expect(r.rows[1].outcome).toBe(VisaCaseImportCommitOutcome.FAILED);
      expect(r.summary.createdCaseCount).toBe(1);
      expect(r.summary.failedRowCount).toBe(1);
      expect(batchRepo.save).toHaveBeenCalled();
      expect(auditLogService.createAuditLog).toHaveBeenCalled();
    });

    /**
     * docs/24 §4 子集自洽：仅家属行时提交阶段无法解析案件 ID → FAILED（与预览 ORPHAN 不同路径）。
     */
    it('FAMILY_MEMBER without prior CASE row in batch yields FAILED at commit', async () => {
      const previewDto: VisaCaseImportPreviewResultDto = {
        dryRun: true,
        contentSha256: 'sha-orph-commit',
        blockingFileErrors: [],
        summary: {
          rowCount: 1,
          okRowCount: 1,
          errorRowCount: 0,
          warningRowCount: 0,
          duplicateSkippedRowCount: 0,
          canProceed: true,
        },
        rows: [
          {
            rowNumber: 3,
            recordType: 'FAMILY_MEMBER',
            status: VisaCaseImportRowStatus.OK,
            errors: [],
            warnings: [],
            resolved: {
              serviceCustomerId: cid,
              legacyCaseRef: 'NO-CASE-IN-BATCH',
              familyMember: {
                memberCustomerId: cid,
                memberRole: VisaCaseMemberRole.OTHER,
                isPrimary: false,
                displayNameSnapshot: 'x',
              },
            },
          },
        ],
      };
      preview.previewFromBuffer.mockResolvedValue(previewDto);
      batchRepo.findOne.mockResolvedValue(null);
      batchRepo.save.mockImplementation((x: VisaCaseImportBatch) =>
        mockSaveResolvedBatch(x, 'batch-orph'),
      );

      const r = await service.commitFromBuffer(
        Buffer.from('x'),
        'user-1',
        null,
        null,
        null,
      );

      expect(r.rows[0].outcome).toBe(VisaCaseImportCommitOutcome.FAILED);
      expect(r.rows[0].message).toContain('案件 ID');
      expect(visaCaseService.create).not.toHaveBeenCalled();
      expect(familyMemberService.addFamilyMember).not.toHaveBeenCalled();
      expect(r.summary.failedRowCount).toBe(1);
    });

    it('preview canProceed true with ERROR row still reports FAILED outcome and saves batch', async () => {
      const rowOk = minimalOkPreview().rows[0];
      const rowErr: typeof rowOk = {
        rowNumber: 3,
        recordType: 'CASE',
        status: VisaCaseImportRowStatus.ERROR,
        errors: [{ code: 'X', message: 'y' }],
        warnings: [],
      };
      const previewDto: VisaCaseImportPreviewResultDto = {
        ...minimalOkPreview(),
        summary: {
          rowCount: 2,
          okRowCount: 1,
          errorRowCount: 1,
          warningRowCount: 0,
          duplicateSkippedRowCount: 0,
          canProceed: true,
        },
        rows: [rowOk, rowErr],
      };
      preview.previewFromBuffer.mockResolvedValue(previewDto);
      batchRepo.findOne.mockResolvedValue(null);
      visaCaseService.create.mockResolvedValue({ id: 'only-one' } as never);
      batchRepo.save.mockImplementation((x: VisaCaseImportBatch) =>
        mockSaveResolvedBatch(x, 'batch-partial'),
      );

      const r = await service.commitFromBuffer(
        Buffer.from('x'),
        'u',
        null,
        null,
        null,
      );

      expect(r.summary.failedRowCount).toBe(1);
      expect(r.rows[1].outcome).toBe(VisaCaseImportCommitOutcome.FAILED);
      expect(r.rows[0].outcome).toBe(VisaCaseImportCommitOutcome.CASE_CREATED);
      expect(batchRepo.save).toHaveBeenCalled();
    });
  });
});
