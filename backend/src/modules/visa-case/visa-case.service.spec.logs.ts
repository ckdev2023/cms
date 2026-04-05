import { NotFoundException } from '@nestjs/common';

import { VisaCaseLogType } from '../../common/constants/enums';
import type { ContextAccessor } from './visa-case.service.spec-helpers';
import {
  buildLogCreatePayload,
  buildNoteRecord,
  buildVisaCaseRecord,
  createQueryBuilderMock,
  MOCK_VISA_CASE_SCOPE_ROW,
} from './visa-case.service.spec-helpers';

export function registerCreateLogTests(getContext: ContextAccessor): void {
  describe('createLog', () => {
    it('should create a case log with required fields', async () => {
      const { service, visaCaseRepo, noteRepo } = getContext();
      const visaCase = buildVisaCaseRecord();
      const savedNote = buildNoteRecord({ id: 'log-new' });

      visaCaseRepo.findOne
        .mockResolvedValueOnce(MOCK_VISA_CASE_SCOPE_ROW)
        .mockResolvedValueOnce(visaCase);
      noteRepo.save.mockResolvedValue(savedNote);
      noteRepo.findOne.mockResolvedValue(savedNote);

      const result = await service.createLog(
        'vc-1',
        buildLogCreatePayload(),
        'user-1',
      );

      expect(result.id).toBe('log-new');
      expect(result.logType).toBe(VisaCaseLogType.GENERAL);
      expect(result.creatorName).toBe('テスト管理者');
      expect(noteRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          visaCaseId: 'vc-1',
          customerId: 'cust-1',
          logType: VisaCaseLogType.GENERAL,
        }),
      );
    });

    it('should create a log with structured follow-up fields', async () => {
      const { service, visaCaseRepo, noteRepo } = getContext();
      const visaCase = buildVisaCaseRecord();
      const savedNote = buildNoteRecord({
        id: 'log-new',
        logType: VisaCaseLogType.SUPPLEMENT,
        submittedItems: '在留カード',
        missingItems: '住民票',
        nextAction: '書類再提出',
        nextFollowUpAt: new Date('2026-05-01T09:00:00.000Z'),
      });

      visaCaseRepo.findOne
        .mockResolvedValueOnce(MOCK_VISA_CASE_SCOPE_ROW)
        .mockResolvedValueOnce(visaCase);
      noteRepo.save.mockResolvedValue(savedNote);
      noteRepo.findOne.mockResolvedValue(savedNote);

      const result = await service.createLog(
        'vc-1',
        buildLogCreatePayload({
          logType: VisaCaseLogType.SUPPLEMENT,
          submittedItems: '在留カード',
          missingItems: '住民票',
          nextAction: '書類再提出',
          nextFollowUpAt: '2026-05-01T09:00:00.000Z',
        }),
        'user-1',
      );

      expect(result.logType).toBe(VisaCaseLogType.SUPPLEMENT);
      expect(result.submittedItems).toBe('在留カード');
      expect(result.missingItems).toBe('住民票');
      expect(result.nextAction).toBe('書類再提出');
    });

    it('should throw NotFoundException when visa case does not exist', async () => {
      const { service, visaCaseRepo } = getContext();
      visaCaseRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createLog('nonexistent', buildLogCreatePayload(), 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
}

export function registerFindLogsTests(getContext: ContextAccessor): void {
  describe('findLogs', () => {
    it('should return paginated logs for a visa case', async () => {
      const { service, visaCaseRepo, noteRepo } = getContext();
      visaCaseRepo.findOne.mockResolvedValueOnce(MOCK_VISA_CASE_SCOPE_ROW);
      visaCaseRepo.count.mockResolvedValue(1);

      const logs = [buildNoteRecord(), buildNoteRecord({ id: 'log-2' })];
      const qb = createQueryBuilderMock([logs, 2]);
      noteRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findLogs('vc-1', {}, 'user-1');

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(qb.where).toHaveBeenCalledWith('n.visaCaseId = :visaCaseId', {
        visaCaseId: 'vc-1',
      });
    });

    it('should filter by logType when specified', async () => {
      const { service, visaCaseRepo, noteRepo } = getContext();
      visaCaseRepo.findOne.mockResolvedValueOnce(MOCK_VISA_CASE_SCOPE_ROW);
      visaCaseRepo.count.mockResolvedValue(1);

      const qb = createQueryBuilderMock([[], 0]);
      noteRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findLogs(
        'vc-1',
        {
          logType: VisaCaseLogType.SUPPLEMENT,
        },
        'user-1',
      );

      expect(qb.andWhere).toHaveBeenCalledWith('n.logType = :logType', {
        logType: VisaCaseLogType.SUPPLEMENT,
      });
    });

    it('should throw NotFoundException when visa case does not exist', async () => {
      const { service, visaCaseRepo } = getContext();
      visaCaseRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.findLogs('nonexistent', {}, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
}

export function registerFindOneLogTests(getContext: ContextAccessor): void {
  describe('findOneLog', () => {
    it('should return log details with creator name', async () => {
      const { service, visaCaseRepo, noteRepo } = getContext();
      visaCaseRepo.findOne.mockResolvedValueOnce(MOCK_VISA_CASE_SCOPE_ROW);
      const log = buildNoteRecord();
      noteRepo.findOne.mockResolvedValue(log);

      const result = await service.findOneLog('vc-1', 'log-1', 'user-1');

      expect(result.id).toBe('log-1');
      expect(result.creatorName).toBe('テスト管理者');
      expect(noteRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'log-1', visaCaseId: 'vc-1' },
        relations: ['creator'],
      });
    });

    it('should throw NotFoundException when log not found', async () => {
      const { service, visaCaseRepo, noteRepo } = getContext();
      visaCaseRepo.findOne.mockResolvedValueOnce(MOCK_VISA_CASE_SCOPE_ROW);
      noteRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findOneLog('vc-1', 'nonexistent', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
}

export function registerUpdateLogTests(getContext: ContextAccessor): void {
  describe('updateLog', () => {
    it('should update log content and return latest', async () => {
      const { service, visaCaseRepo, noteRepo } = getContext();
      visaCaseRepo.findOne.mockResolvedValueOnce(MOCK_VISA_CASE_SCOPE_ROW);
      const existing = buildNoteRecord();
      const updated = buildNoteRecord({ content: '更新されたログ' });

      noteRepo.findOne
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(updated);

      const result = await service.updateLog(
        'vc-1',
        'log-1',
        {
          content: '更新されたログ',
        },
        'user-1',
      );

      expect(result.content).toBe('更新されたログ');
    });

    it('should update structured fields', async () => {
      const { service, visaCaseRepo, noteRepo } = getContext();
      visaCaseRepo.findOne.mockResolvedValueOnce(MOCK_VISA_CASE_SCOPE_ROW);
      const existing = buildNoteRecord();
      const updated = buildNoteRecord({
        missingItems: '住民票',
        nextAction: '再確認',
      });

      noteRepo.findOne
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(updated);

      const result = await service.updateLog(
        'vc-1',
        'log-1',
        {
          missingItems: '住民票',
          nextAction: '再確認',
        },
        'user-1',
      );

      expect(result.missingItems).toBe('住民票');
      expect(result.nextAction).toBe('再確認');
    });

    it('should throw NotFoundException when log not found', async () => {
      const { service, visaCaseRepo, noteRepo } = getContext();
      visaCaseRepo.findOne.mockResolvedValueOnce(MOCK_VISA_CASE_SCOPE_ROW);
      noteRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateLog('vc-1', 'nonexistent', { content: 'x' }, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
}

export function registerRemoveLogTests(getContext: ContextAccessor): void {
  describe('removeLog', () => {
    it('should soft-remove the log', async () => {
      const { service, visaCaseRepo, noteRepo } = getContext();
      visaCaseRepo.findOne.mockResolvedValueOnce(MOCK_VISA_CASE_SCOPE_ROW);
      const existing = buildNoteRecord();
      noteRepo.findOne.mockResolvedValue(existing);

      await service.removeLog('vc-1', 'log-1', 'user-1');

      expect(noteRepo.softRemove).toHaveBeenCalledWith(existing);
    });

    it('should throw NotFoundException when log not found', async () => {
      const { service, visaCaseRepo, noteRepo } = getContext();
      visaCaseRepo.findOne.mockResolvedValueOnce(MOCK_VISA_CASE_SCOPE_ROW);
      noteRepo.findOne.mockResolvedValue(null);

      await expect(
        service.removeLog('vc-1', 'nonexistent', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
}
