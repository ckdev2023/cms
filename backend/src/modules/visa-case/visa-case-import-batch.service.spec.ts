import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { User } from '../auth/entities/user.entity';
import { VisaCaseImportBatch } from './entities/visa-case-import-batch.entity';
import { VisaCaseImportBatchService } from './visa-case-import-batch.service';

/* eslint-disable max-lines-per-function -- 只读批次服务用例与 fixture 同文件收口 */
describe('VisaCaseImportBatchService', () => {
  let service: VisaCaseImportBatchService;
  let batchRepo: {
    findAndCount: jest.Mock;
    findOne: jest.Mock;
  };
  let userRepo: { find: jest.Mock };

  const batchAt = new Date('2026-04-04T08:00:00.000Z');

  beforeEach(async () => {
    batchRepo = {
      findAndCount: jest.fn(),
      findOne: jest.fn(),
    };
    userRepo = { find: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        VisaCaseImportBatchService,
        {
          provide: getRepositoryToken(VisaCaseImportBatch),
          useValue: batchRepo,
        },
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile();

    service = moduleRef.get(VisaCaseImportBatchService);
  });

  it('lists batches with creator display names (docs/24 audit reconciliation)', async () => {
    const b1: VisaCaseImportBatch = {
      id: 'b1111111-1111-4111-8111-111111111111',
      contentSha256: 'a'.repeat(64),
      createdBy: 'u1111111-1111-4111-8111-111111111111',
      summary: {
        fileName: 'a.csv',
        rowCount: 2,
        createdCaseCount: 1,
        skippedDuplicateCaseCount: 0,
        addedMemberCount: 0,
        createdFilePathCount: 0,
        createdLogCount: 0,
        failedRowCount: 0,
      },
      createdAt: batchAt,
    };
    batchRepo.findAndCount.mockResolvedValue([[b1], 1]);
    userRepo.find.mockResolvedValue([
      { id: b1.createdBy, displayName: '担当者A' },
    ]);

    const { items, total } = await service.list(1, 20);

    expect(total).toBe(1);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      importBatchId: b1.id,
      contentSha256: b1.contentSha256,
      createdBy: b1.createdBy,
      createdByDisplayName: '担当者A',
      createdAt: batchAt.toISOString(),
      summary: {
        fileName: 'a.csv',
        rowCount: 2,
        createdCaseCount: 1,
        skippedDuplicateCaseCount: 0,
        addedMemberCount: 0,
        createdFilePathCount: 0,
        createdLogCount: 0,
        failedRowCount: 0,
      },
    });
    expect(batchRepo.findAndCount).toHaveBeenCalledWith({
      order: { createdAt: 'DESC' },
      skip: 0,
      take: 20,
    });
  });

  it('findOneById returns null when missing', async () => {
    batchRepo.findOne.mockResolvedValue(null);
    await expect(service.findOneById('missing-uuid')).resolves.toBeNull();
  });

  it('findOneById maps summary when present', async () => {
    const id = 'c2222222-2222-4222-8222-222222222222';
    const batch: VisaCaseImportBatch = {
      id,
      contentSha256: 'b'.repeat(64),
      createdBy: null,
      summary: null,
      createdAt: batchAt,
    };
    batchRepo.findOne.mockResolvedValue(batch);
    userRepo.find.mockResolvedValue([]);

    const row = await service.findOneById(id);
    expect(row).toMatchObject({
      importBatchId: id,
      createdBy: null,
      createdByDisplayName: null,
      summary: null,
    });
  });
});
