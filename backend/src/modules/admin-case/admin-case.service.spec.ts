import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AdminCaseStatus } from '../../common/constants/enums';
import { FileEntity } from '../file/entities/file.entity';
import { AdminCaseService } from './admin-case.service';
import {
  createMockCase,
  createMockDocument,
  createMockInterview,
  createMockRepositories,
  type MockRepository,
} from './admin-case.service.spec-helpers';
import { AdminCase } from './entities/admin-case.entity';
import { AdminCaseDocument } from './entities/admin-case-document.entity';
import { AdminCaseInterview } from './entities/admin-case-interview.entity';

type TestContext = {
  service: AdminCaseService;
  caseRepo: MockRepository;
  interviewRepo: MockRepository;
  documentRepo: MockRepository;
};

type ContextGetter = () => TestContext;

function registerCaseCreateTests(getCtx: ContextGetter): void {
  describe('create', () => {
    it('should create a case with default DRAFT status', async () => {
      const { service, caseRepo } = getCtx();
      const mockCase = createMockCase({ id: 'case-new' });
      caseRepo.save.mockResolvedValue(mockCase);
      caseRepo.findOne.mockResolvedValue(mockCase);

      const result = await service.create(
        {
          customerId: 'customer-1',
          caseName: 'テスト案件',
          applicantName: '田中太郎',
        },
        'user-1',
      );

      expect(caseRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: 'customer-1',
          caseName: 'テスト案件',
          status: AdminCaseStatus.DRAFT,
          createdBy: 'user-1',
        }),
      );
      expect(result.id).toBe('case-new');
    });
  });
}

function registerCaseLookupTests(getCtx: ContextGetter): void {
  describe('findOne', () => {
    it('should return case with relations', async () => {
      const { service, caseRepo } = getCtx();
      const mockCase = createMockCase();
      caseRepo.findOne.mockResolvedValue(mockCase);

      const result = await service.findOne('case-1');
      expect(result.id).toBe('case-1');
      expect(caseRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'case-1' },
        relations: ['customer', 'owner', 'interviews', 'interviews.creator'],
      });
    });

    it('should throw NotFoundException for non-existent case', async () => {
      const { service, caseRepo } = getCtx();
      caseRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
}

function registerCaseMutationTests(getCtx: ContextGetter): void {
  describe('case mutations', () => {
    it('should update case fields', async () => {
      const { service, caseRepo } = getCtx();
      const mockCase = createMockCase();
      const updated = { ...mockCase, caseName: '更新案件' };
      caseRepo.save.mockResolvedValue(updated);
      caseRepo.findOne
        .mockResolvedValueOnce(mockCase)
        .mockResolvedValueOnce(updated);

      const result = await service.update(
        'case-1',
        { caseName: '更新案件' },
        'user-2',
      );

      expect(result.caseName).toBe('更新案件');
    });

    it('should soft-delete a case', async () => {
      const { service, caseRepo } = getCtx();
      const mockCase = createMockCase();
      caseRepo.findOne.mockResolvedValue(mockCase);

      await service.remove('case-1');
      expect(caseRepo.softRemove).toHaveBeenCalledWith(mockCase);
    });

    it('should throw for non-existent case removal', async () => {
      const { service, caseRepo } = getCtx();
      caseRepo.findOne.mockResolvedValue(null);
      await expect(service.remove('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should recover a soft-deleted case', async () => {
      const { service, caseRepo } = getCtx();
      const deletedCase = createMockCase({ deletedAt: new Date('2026-03-01') });
      const restoredCase = createMockCase({ deletedAt: null });
      caseRepo.findOne
        .mockResolvedValueOnce(deletedCase)
        .mockResolvedValueOnce(restoredCase);

      const result = await service.restore('case-1');

      expect(caseRepo.findOne).toHaveBeenNthCalledWith(1, {
        where: { id: 'case-1' },
        withDeleted: true,
      });
      expect(caseRepo.recover).toHaveBeenCalledWith(deletedCase);
      expect(result.deletedAt).toBeNull();
    });

    it.each([
      {
        caseId: 'nonexistent',
        deletedAt: undefined,
        error: NotFoundException,
      },
      {
        caseId: 'case-1',
        deletedAt: null,
        error: BadRequestException,
      },
    ])(
      'should throw during restore when precondition is not met',
      async ({ caseId, deletedAt, error }) => {
        const { service, caseRepo } = getCtx();
        caseRepo.findOne.mockResolvedValue(
          deletedAt === undefined ? null : createMockCase({ deletedAt }),
        );
        await expect(service.restore(caseId)).rejects.toThrow(error);
      },
    );
  });
}

function registerStatusTransitionTests(getCtx: ContextGetter): void {
  describe('status transitions', () => {
    it.each([
      [AdminCaseStatus.DRAFT, AdminCaseStatus.ACCEPTED],
      [AdminCaseStatus.DRAFT, AdminCaseStatus.CANCELLED],
      [AdminCaseStatus.ACCEPTED, AdminCaseStatus.MATERIAL_PENDING],
      [AdminCaseStatus.SUBMITTED, AdminCaseStatus.APPROVED],
      [AdminCaseStatus.SUBMITTED, AdminCaseStatus.REJECTED],
      [AdminCaseStatus.REJECTED, AdminCaseStatus.MATERIAL_PENDING],
    ])('should allow %s -> %s', async (from, to) => {
      const { service, caseRepo } = getCtx();
      caseRepo.findOne.mockResolvedValue(createMockCase({ status: from }));

      await service.updateStatus('case-1', to, 'user-1');

      expect(caseRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: to }),
      );
    });

    it.each([
      [AdminCaseStatus.DRAFT, AdminCaseStatus.COMPLETED],
      [AdminCaseStatus.COMPLETED, AdminCaseStatus.DRAFT],
      [AdminCaseStatus.CANCELLED, AdminCaseStatus.DRAFT],
      [AdminCaseStatus.APPROVED, AdminCaseStatus.REJECTED],
    ])('should reject %s -> %s', async (from, to) => {
      const { service, caseRepo } = getCtx();
      caseRepo.findOne.mockResolvedValue(createMockCase({ status: from }));

      await expect(
        service.updateStatus('case-1', to, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getAvailableTransitions', () => {
    it.each([
      [
        AdminCaseStatus.DRAFT,
        [AdminCaseStatus.ACCEPTED, AdminCaseStatus.CANCELLED],
      ],
      [AdminCaseStatus.COMPLETED, []],
      [AdminCaseStatus.CANCELLED, []],
      [
        AdminCaseStatus.REJECTED,
        [AdminCaseStatus.MATERIAL_PENDING, AdminCaseStatus.CANCELLED],
      ],
    ])('should return available transitions for %s', (status, expected) => {
      const { service } = getCtx();
      expect(service.getAvailableTransitions(status)).toEqual(expected);
    });
  });
}

function registerInterviewTests(getCtx: ContextGetter): void {
  describe('interviews', () => {
    it('should create interview linked to a case', async () => {
      const { service, caseRepo, interviewRepo } = getCtx();
      const mockCase = createMockCase();
      const mockInterview = createMockInterview({ id: 'iv-new' });
      caseRepo.findOne.mockResolvedValue(mockCase);
      interviewRepo.save.mockResolvedValue(mockInterview);
      interviewRepo.findOne.mockResolvedValue(mockInterview);

      const result = await service.createInterview(
        'case-1',
        {
          interviewDate: '2026-03-15',
          content: '面談内容テスト',
          interviewLocation: '事務所',
        },
        'user-1',
      );

      expect(interviewRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          adminCaseId: 'case-1',
          customerId: 'customer-1',
          content: '面談内容テスト',
        }),
      );
      expect(result).toBeDefined();
    });

    it.each([
      ['findInterview', 'nonexistent'],
      ['removeInterview', 'nonexistent'],
    ])('should throw when %s target is missing', async (method, id) => {
      const { service, interviewRepo } = getCtx();
      interviewRepo.findOne.mockResolvedValue(null);
      await expect(
        service[method as 'findInterview' | 'removeInterview'](id),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return interview with creator', async () => {
      const { service, interviewRepo } = getCtx();
      const mockInterview = createMockInterview();
      interviewRepo.findOne.mockResolvedValue(mockInterview);
      const result = await service.findInterview('iv-1');
      expect(result.id).toBe('iv-1');
    });

    it('should update interview content', async () => {
      const { service, interviewRepo } = getCtx();
      const mockInterview = createMockInterview();
      const updated = { ...mockInterview, content: '更新内容' };
      interviewRepo.save.mockResolvedValue(updated);
      interviewRepo.findOne
        .mockResolvedValueOnce(mockInterview)
        .mockResolvedValueOnce(updated);

      const result = await service.updateInterview(
        'iv-1',
        { content: '更新内容' },
        'user-1',
      );

      expect(result.content).toBe('更新内容');
    });

    it('should soft-delete interview', async () => {
      const { service, interviewRepo } = getCtx();
      const mockInterview = createMockInterview();
      interviewRepo.findOne.mockResolvedValue(mockInterview);
      await service.removeInterview('iv-1');
      expect(interviewRepo.softRemove).toHaveBeenCalledWith(mockInterview);
    });

    it('should throw if parent case is missing during interview creation', async () => {
      const { service, caseRepo } = getCtx();
      caseRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createInterview(
          'nonexistent',
          { interviewDate: '2026-03-15', content: 'test' },
          'user-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
}

function registerDocumentQueryTests(getCtx: ContextGetter): void {
  describe('document queries', () => {
    it('should return documents for a case', async () => {
      const { service, caseRepo, documentRepo } = getCtx();
      const mockDocs = [createMockDocument()];
      caseRepo.findOne.mockResolvedValue(createMockCase());
      documentRepo.find.mockResolvedValue(mockDocs);

      const result = await service.findDocuments('case-1');

      expect(result).toHaveLength(1);
      expect(documentRepo.find).toHaveBeenCalledWith({
        where: { adminCaseId: 'case-1' },
        relations: ['file', 'file.uploader'],
        order: { createdAt: 'DESC' },
      });
    });

    it('should throw if case not found during document query', async () => {
      const { service, caseRepo } = getCtx();
      caseRepo.findOne.mockResolvedValue(null);
      await expect(service.findDocuments('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it.each([
      ['doc-1', createMockDocument()],
      ['nonexistent', null],
    ])('should resolve document lookup for %s', async (docId, mockDoc) => {
      const { service, documentRepo } = getCtx();
      documentRepo.findOne.mockResolvedValue(mockDoc);

      if (!mockDoc) {
        await expect(service.findDocument(docId)).rejects.toThrow(
          NotFoundException,
        );
        return;
      }

      const result = await service.findDocument(docId);
      expect(result.id).toBe(docId);
      expect(documentRepo.findOne).toHaveBeenCalledWith({
        where: { id: docId },
        relations: ['file', 'file.uploader'],
      });
    });

    it.each([
      { file: createMockDocument().file, expectedNull: false },
      { file: null as unknown as FileEntity, expectedNull: true },
    ])(
      'should map document file payload correctly',
      ({ file, expectedNull }) => {
        const { service } = getCtx();
        const dto = service.toDocumentDto(createMockDocument({ file }));
        expect(dto.file === null).toBe(expectedNull);

        if (!expectedNull && dto.file) {
          expect(dto.file.fileName).toBe('test.pdf');
          expect(dto.file.uploaderName).toBe('担当者A');
        }
      },
    );
  });
}

function registerDocumentCreateTests(getCtx: ContextGetter): void {
  describe('document creation', () => {
    it.each([
      {
        payload: {
          fileId: 'file-1',
          documentType: '申請書',
          remark: 'テスト備考',
        },
        expected: { documentType: '申請書', remark: 'テスト備考' },
      },
      {
        payload: { fileId: 'file-1' },
        expected: { documentType: null, remark: null },
      },
    ])(
      'should create document with normalized optional fields',
      async ({ payload, expected }) => {
        const { service, caseRepo, documentRepo } = getCtx();
        caseRepo.findOne.mockResolvedValue(createMockCase());
        documentRepo.save.mockResolvedValue(
          createMockDocument({
            id: 'doc-new',
            documentType: expected.documentType,
            remark: expected.remark,
          }),
        );
        documentRepo.findOne.mockResolvedValue(
          createMockDocument({
            id: 'doc-new',
            documentType: expected.documentType,
            remark: expected.remark,
          }),
        );

        await service.createDocument('case-1', payload);

        expect(documentRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({
            adminCaseId: 'case-1',
            fileId: 'file-1',
            documentType: expected.documentType,
            remark: expected.remark,
          }),
        );
      },
    );

    it('should throw if case not found during document creation', async () => {
      const { service, caseRepo } = getCtx();
      caseRepo.findOne.mockResolvedValue(null);
      await expect(
        service.createDocument('nonexistent', { fileId: 'file-1' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
}

function registerDocumentMutationTests(getCtx: ContextGetter): void {
  describe('document mutations', () => {
    it('should update document type and remark', async () => {
      const { service, documentRepo } = getCtx();
      const mockDoc = createMockDocument();
      const updated = {
        ...mockDoc,
        documentType: '在留カード',
        remark: '更新備考',
      };
      documentRepo.save.mockResolvedValue(updated);
      documentRepo.findOne
        .mockResolvedValueOnce(mockDoc)
        .mockResolvedValueOnce(updated);

      const result = await service.updateDocument('doc-1', {
        documentType: '在留カード',
        remark: '更新備考',
      });

      expect(result.documentType).toBe('在留カード');
      expect(result.remark).toBe('更新備考');
    });

    it.each([
      ['removeDocument', 'doc-1', createMockDocument()],
      ['removeDocument', 'nonexistent', null],
    ])('should handle %s for %s', async (_, docId, mockDoc) => {
      const { service, documentRepo } = getCtx();
      documentRepo.findOne.mockResolvedValue(mockDoc);

      if (!mockDoc) {
        await expect(service.removeDocument(docId)).rejects.toThrow(
          NotFoundException,
        );
        return;
      }

      await service.removeDocument(docId);
      expect(documentRepo.remove).toHaveBeenCalledWith(mockDoc);
    });
  });
}

describe('AdminCaseService', () => {
  let service: AdminCaseService;
  let caseRepo: MockRepository;
  let interviewRepo: MockRepository;
  let documentRepo: MockRepository;

  beforeEach(async () => {
    ({ caseRepo, interviewRepo, documentRepo } = createMockRepositories());

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminCaseService,
        { provide: getRepositoryToken(AdminCase), useValue: caseRepo },
        {
          provide: getRepositoryToken(AdminCaseInterview),
          useValue: interviewRepo,
        },
        {
          provide: getRepositoryToken(AdminCaseDocument),
          useValue: documentRepo,
        },
      ],
    }).compile();

    service = module.get<AdminCaseService>(AdminCaseService);
  });

  const getCtx = (): TestContext => ({
    service,
    caseRepo,
    interviewRepo,
    documentRepo,
  });

  registerCaseCreateTests(getCtx);
  registerCaseLookupTests(getCtx);
  registerCaseMutationTests(getCtx);
  registerStatusTransitionTests(getCtx);
  registerInterviewTests(getCtx);
  registerDocumentQueryTests(getCtx);
  registerDocumentCreateTests(getCtx);
  registerDocumentMutationTests(getCtx);
});
