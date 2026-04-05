import { NotFoundException } from '@nestjs/common';

import { FilePathType } from '../../common/constants/enums';
import type { ContextAccessor } from './visa-case.service.spec-helpers';
import {
  buildFilePathRecord,
  createQueryBuilderMock,
  MOCK_VISA_CASE_SCOPE_ROW,
} from './visa-case.service.spec-helpers';

export function registerCreateFilePathTests(getContext: ContextAccessor): void {
  describe('createFilePath', () => {
    it('should create a customer-level file path', async () => {
      const { service, filePathRepo } = getContext();
      const saved = buildFilePathRecord({ id: 'fp-new' });
      filePathRepo.save.mockResolvedValue(saved);
      filePathRepo.findOne.mockResolvedValue(saved);

      const result = await service.createFilePath(
        'cust-1',
        { customerId: 'cust-1', filePath: '/nas/customers/001/docs' },
        'user-1',
      );

      expect(result.id).toBe('fp-new');
      expect(result.pathType).toBe(FilePathType.OTHER);
      expect(result.creatorName).toBe('テスト管理者');
      expect(filePathRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: 'cust-1',
          filePath: '/nas/customers/001/docs',
          createdBy: 'user-1',
        }),
      );
    });

    it('should create a case-level file path with visaCaseId', async () => {
      const { service, filePathRepo, visaCaseRepo } = getContext();
      visaCaseRepo.findOne.mockResolvedValueOnce(MOCK_VISA_CASE_SCOPE_ROW);
      visaCaseRepo.count.mockResolvedValue(1);
      const saved = buildFilePathRecord({
        id: 'fp-new',
        visaCaseId: 'vc-1',
        pathType: FilePathType.CASE_DOCUMENT,
      });
      filePathRepo.save.mockResolvedValue(saved);
      filePathRepo.findOne.mockResolvedValue(saved);

      const result = await service.createFilePath(
        'cust-1',
        {
          customerId: 'cust-1',
          filePath: '/nas/cases/vc-1/submission',
          visaCaseId: 'vc-1',
          pathType: FilePathType.CASE_DOCUMENT,
        },
        'user-1',
      );

      expect(result.visaCaseId).toBe('vc-1');
      expect(result.pathType).toBe(FilePathType.CASE_DOCUMENT);
    });

    it('should throw NotFoundException when customer does not exist', async () => {
      const { service, customerRepo } = getContext();
      customerRepo.count.mockResolvedValue(0);

      await expect(
        service.createFilePath(
          'nonexistent',
          { customerId: 'nonexistent', filePath: '/path' },
          'user-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when visa case does not exist', async () => {
      const { service, visaCaseRepo } = getContext();
      visaCaseRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.createFilePath(
          'cust-1',
          {
            customerId: 'cust-1',
            filePath: '/path',
            visaCaseId: 'nonexistent',
          },
          'user-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
}

export function registerFindFilePathsByCustomerTests(
  getContext: ContextAccessor,
): void {
  describe('findFilePathsByCustomer', () => {
    it('should return paginated file paths for a customer', async () => {
      const { service, filePathRepo } = getContext();
      const fp = buildFilePathRecord();
      const qb = createQueryBuilderMock([[fp], 1]);
      filePathRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findFilePathsByCustomer('cust-1', {});

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.items[0].id).toBe('fp-1');
      expect(qb.where).toHaveBeenCalledWith('fp.customerId = :customerId', {
        customerId: 'cust-1',
      });
    });

    it('should filter by pathType when provided', async () => {
      const { service, filePathRepo } = getContext();
      const qb = createQueryBuilderMock([[], 0]);
      filePathRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findFilePathsByCustomer('cust-1', {
        pathType: FilePathType.CERTIFICATE,
      });

      expect(qb.andWhere).toHaveBeenCalledWith('fp.pathType = :pathType', {
        pathType: FilePathType.CERTIFICATE,
      });
    });

    it('should throw NotFoundException when customer does not exist', async () => {
      const { service, customerRepo } = getContext();
      customerRepo.count.mockResolvedValue(0);

      await expect(
        service.findFilePathsByCustomer('nonexistent', {}),
      ).rejects.toThrow(NotFoundException);
    });
  });
}

export function registerFindFilePathsByVisaCaseTests(
  getContext: ContextAccessor,
): void {
  describe('findFilePathsByVisaCase', () => {
    it('should return paginated file paths for a visa case', async () => {
      const { service, filePathRepo, visaCaseRepo } = getContext();
      visaCaseRepo.findOne.mockResolvedValueOnce(MOCK_VISA_CASE_SCOPE_ROW);
      const fp = buildFilePathRecord({ visaCaseId: 'vc-1' });
      const qb = createQueryBuilderMock([[fp], 1]);
      filePathRepo.createQueryBuilder.mockReturnValue(qb);
      visaCaseRepo.count.mockResolvedValue(1);

      const result = await service.findFilePathsByVisaCase(
        'vc-1',
        {},
        'user-1',
      );

      expect(result.items).toHaveLength(1);
      expect(qb.where).toHaveBeenCalledWith('fp.visaCaseId = :visaCaseId', {
        visaCaseId: 'vc-1',
      });
    });

    it('should throw NotFoundException when visa case does not exist', async () => {
      const { service, visaCaseRepo } = getContext();
      visaCaseRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.findFilePathsByVisaCase('nonexistent', {}, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
}

export function registerUpdateFilePathTests(getContext: ContextAccessor): void {
  describe('updateFilePath', () => {
    it('should update file path fields', async () => {
      const { service, filePathRepo } = getContext();
      const existing = buildFilePathRecord();
      filePathRepo.findOne
        .mockResolvedValueOnce({ visaCaseId: null })
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce({
          ...existing,
          pathType: FilePathType.CONTRACT,
          remark: '更新後備考',
        });

      const result = await service.updateFilePath(
        'fp-1',
        {
          pathType: FilePathType.CONTRACT,
          remark: '更新後備考',
        },
        'user-1',
      );

      expect(filePathRepo.save).toHaveBeenCalled();
      expect(result.pathType).toBe(FilePathType.CONTRACT);
      expect(result.remark).toBe('更新後備考');
    });

    it('should throw NotFoundException when file path not found', async () => {
      const { service, filePathRepo } = getContext();
      filePathRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await expect(
        service.updateFilePath('nonexistent', { filePath: '/new' }, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should validate visa case exists when changing visaCaseId', async () => {
      const { service, filePathRepo, visaCaseRepo } = getContext();
      const existing = buildFilePathRecord();
      filePathRepo.findOne
        .mockResolvedValueOnce({ visaCaseId: null })
        .mockResolvedValueOnce(existing);
      visaCaseRepo.count.mockResolvedValue(0);

      await expect(
        service.updateFilePath('fp-1', { visaCaseId: 'nonexistent' }, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
}

export function registerRemoveFilePathTests(getContext: ContextAccessor): void {
  describe('removeFilePath', () => {
    it('should soft-remove the file path', async () => {
      const { service, filePathRepo } = getContext();
      const existing = buildFilePathRecord();
      filePathRepo.findOne
        .mockResolvedValueOnce({ visaCaseId: null })
        .mockResolvedValueOnce(existing);

      await service.removeFilePath('fp-1', 'user-1');

      expect(filePathRepo.softRemove).toHaveBeenCalledWith(existing);
    });

    it('should throw NotFoundException when file path not found', async () => {
      const { service, filePathRepo } = getContext();
      filePathRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await expect(
        service.removeFilePath('nonexistent', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
}
