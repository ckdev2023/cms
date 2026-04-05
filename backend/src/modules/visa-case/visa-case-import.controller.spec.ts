import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';

import { VisaCaseImportController } from './visa-case-import.controller';
import { VisaCaseImportBatchService } from './visa-case-import-batch.service';
import { VisaCaseImportCommitService } from './visa-case-import-commit.service';
import {
  type VisaCaseImportPreviewResultDto,
  VisaCaseImportPreviewService,
} from './visa-case-import-preview.service';

/* eslint-disable max-lines-per-function -- controller 导入契约用例 */
describe('VisaCaseImportController', () => {
  let controller: VisaCaseImportController;
  let previewService: jest.Mocked<
    Pick<VisaCaseImportPreviewService, 'previewFromBuffer'>
  >;
  let commitService: jest.Mocked<
    Pick<VisaCaseImportCommitService, 'commitFromBuffer'>
  >;
  let batchService: jest.Mocked<
    Pick<VisaCaseImportBatchService, 'list' | 'findOneById'>
  >;

  const samplePreviewPayload = (): VisaCaseImportPreviewResultDto => ({
    dryRun: true,
    contentSha256: 'abc123',
    blockingFileErrors: [],
    summary: {
      rowCount: 0,
      okRowCount: 0,
      errorRowCount: 0,
      warningRowCount: 0,
      duplicateSkippedRowCount: 0,
      canProceed: true,
    },
    rows: [],
  });

  beforeEach(async () => {
    previewService = { previewFromBuffer: jest.fn() };
    commitService = { commitFromBuffer: jest.fn() };
    batchService = { list: jest.fn(), findOneById: jest.fn() };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [VisaCaseImportController],
      providers: [
        { provide: VisaCaseImportPreviewService, useValue: previewService },
        { provide: VisaCaseImportCommitService, useValue: commitService },
        { provide: VisaCaseImportBatchService, useValue: batchService },
      ],
    }).compile();

    controller = moduleRef.get(VisaCaseImportController);
  });

  it('preview rejects missing or empty file buffer (docs/24 §2)', async () => {
    await expect(controller.previewVisaCaseImport(undefined)).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      controller.previewVisaCaseImport({
        buffer: Buffer.alloc(0),
      } as Express.Multer.File),
    ).rejects.toThrow(BadRequestException);
  });

  it('preview delegates to service with upload buffer and returns ApiResponse envelope', async () => {
    const payload = samplePreviewPayload();
    previewService.previewFromBuffer.mockResolvedValue(payload);
    const buf = Buffer.from('record_type,customer_id\nCASE,x\n', 'utf8');
    const file = {
      buffer: buf,
      originalname: 'hist.csv',
    } as Express.Multer.File;

    const res = await controller.previewVisaCaseImport(file);

    expect(res.code).toBe(0);
    expect(res.data).toBe(payload);
    expect(previewService.previewFromBuffer).toHaveBeenCalledWith(buf);
  });

  it('commit rejects missing or empty file buffer', async () => {
    await expect(
      controller.commitVisaCaseImport(undefined, {} as never),
    ).rejects.toThrow(BadRequestException);
  });

  it('commit forwards buffer, user id, file name and audit fields to service', async () => {
    const payload = {
      importBatchId: 'batch-1',
      contentSha256: 'sha',
      fileName: 'a.csv',
      createdBy: 'user-uuid',
      createdAt: '2026-04-04T00:00:00.000Z',
      summary: {
        rowCount: 1,
        createdCaseCount: 1,
        skippedDuplicateCaseCount: 0,
        addedMemberCount: 0,
        createdFilePathCount: 0,
        createdLogCount: 0,
        failedRowCount: 0,
      },
      rows: [],
    };
    commitService.commitFromBuffer.mockResolvedValue(payload as never);
    const buf = Buffer.from('x', 'utf8');
    const req = {
      user: { id: 'user-uuid' },
      ip: '10.0.0.1',
      socket: { remoteAddress: undefined },
      headers: { 'user-agent': 'jest' },
    } as Parameters<VisaCaseImportController['commitVisaCaseImport']>[1];

    const res = await controller.commitVisaCaseImport(
      { buffer: buf, originalname: 'a.csv' } as Express.Multer.File,
      req,
    );

    expect(res.code).toBe(0);
    expect(res.data).toEqual(payload);
    expect(commitService.commitFromBuffer).toHaveBeenCalledWith(
      buf,
      'user-uuid',
      'a.csv',
      '10.0.0.1',
      'jest',
    );
  });

  it('listVisaCaseImportBatches returns paginated audit rows (docs/24 §3.5)', async () => {
    const item = {
      importBatchId: 'b1',
      contentSha256: 'c'.repeat(64),
      createdBy: 'u1',
      createdByDisplayName: 'Test',
      createdAt: '2026-04-04T01:00:00.000Z',
      summary: {
        fileName: 'x.csv',
        rowCount: 1,
        createdCaseCount: 1,
        skippedDuplicateCaseCount: 0,
        addedMemberCount: 0,
        createdFilePathCount: 0,
        createdLogCount: 0,
        failedRowCount: 0,
      },
    };
    batchService.list.mockResolvedValue({ items: [item], total: 1 });

    const res = await controller.listVisaCaseImportBatches({
      page: 1,
      pageSize: 20,
    });

    expect(res.code).toBe(0);
    expect(res.data?.items).toEqual([item]);
    expect(res.data?.total).toBe(1);
    expect(batchService.list).toHaveBeenCalledWith(1, 20);
  });

  it('getVisaCaseImportBatch throws NotFoundException when batch missing', async () => {
    batchService.findOneById.mockResolvedValue(null);
    await expect(
      controller.getVisaCaseImportBatch('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
