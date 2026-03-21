import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { NotFoundException, BadRequestException } from '@nestjs/common'
import { AdminCaseService } from './admin-case.service'
import { AdminCase } from './entities/admin-case.entity'
import { AdminCaseInterview } from './entities/admin-case-interview.entity'
import { AdminCaseDocument } from './entities/admin-case-document.entity'
import { AdminCaseStatus } from '../../common/constants/enums'

function createMockCase(overrides: Partial<AdminCase> = {}): AdminCase {
  return {
    id: 'case-1',
    customerId: 'customer-1',
    caseName: 'テスト案件',
    applicantName: '田中太郎',
    residenceStatus: '技術・人文知識・国際業務',
    status: AdminCaseStatus.DRAFT,
    expireDate: new Date('2027-03-31'),
    ownerUserId: 'user-1',
    createdBy: 'user-1',
    updatedBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    customer: { id: 'customer-1', customerName: 'テスト顧客' } as any,
    owner: { id: 'user-1', displayName: '担当者A' } as any,
    interviews: [],
    documents: [],
    tasks: [],
    ...overrides,
  } as AdminCase
}

function createMockInterview(
  overrides: Partial<AdminCaseInterview> = {},
): AdminCaseInterview {
  return {
    id: 'iv-1',
    adminCaseId: 'case-1',
    customerId: 'customer-1',
    interviewDate: new Date('2026-03-15'),
    interviewLocation: '事務所',
    content: '面談内容テスト',
    createdBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    adminCase: {} as any,
    customer: {} as any,
    creator: { id: 'user-1', displayName: '担当者A' } as any,
    ...overrides,
  } as AdminCaseInterview
}

function createMockDocument(
  overrides: Partial<AdminCaseDocument> = {},
): AdminCaseDocument {
  return {
    id: 'doc-1',
    adminCaseId: 'case-1',
    fileId: 'file-1',
    documentType: '申請書',
    remark: 'テスト備考',
    createdAt: new Date(),
    adminCase: {} as any,
    file: {
      id: 'file-1',
      fileName: 'test.pdf',
      fileExt: '.pdf',
      fileSize: 12345,
      mimeType: 'application/pdf',
      description: null,
      uploader: { displayName: '担当者A' },
      createdAt: new Date(),
    } as any,
    ...overrides,
  } as AdminCaseDocument
}

describe('AdminCaseService', () => {
  let service: AdminCaseService
  let caseRepo: Record<string, jest.Mock>
  let interviewRepo: Record<string, jest.Mock>
  let documentRepo: Record<string, jest.Mock>

  beforeEach(async () => {
    caseRepo = {
      create: jest.fn().mockImplementation((d) => ({ ...d, id: 'case-new' })),
      save: jest.fn().mockImplementation((c) => Promise.resolve(c)),
      findOne: jest.fn(),
      softRemove: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn(),
    }

    interviewRepo = {
      create: jest.fn().mockImplementation((d) => ({ ...d, id: 'iv-new' })),
      save: jest.fn().mockImplementation((iv) => Promise.resolve(iv)),
      findOne: jest.fn(),
      softRemove: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn(),
    }

    documentRepo = {
      create: jest.fn().mockImplementation((d) => ({ ...d, id: 'doc-new' })),
      save: jest.fn().mockImplementation((d) => Promise.resolve(d)),
      find: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn().mockResolvedValue(undefined),
    }

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
    }).compile()

    service = module.get<AdminCaseService>(AdminCaseService)
  })

  // ── Case CRUD ─────────────────────────────────────────

  describe('create', () => {
    it('should create a case with default DRAFT status', async () => {
      const mockCase = createMockCase({ id: 'case-new' })
      caseRepo.save.mockResolvedValue(mockCase)
      caseRepo.findOne.mockResolvedValue(mockCase)

      const result = await service.create(
        {
          customerId: 'customer-1',
          caseName: 'テスト案件',
          applicantName: '田中太郎',
        },
        'user-1',
      )

      expect(caseRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: 'customer-1',
          caseName: 'テスト案件',
          status: AdminCaseStatus.DRAFT,
          createdBy: 'user-1',
        }),
      )
      expect(result).toBeDefined()
      expect(result.id).toBe('case-new')
    })
  })

  describe('findOne', () => {
    it('should return case with relations', async () => {
      const mockCase = createMockCase()
      caseRepo.findOne.mockResolvedValue(mockCase)

      const result = await service.findOne('case-1')
      expect(result.id).toBe('case-1')
      expect(caseRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'case-1' },
        relations: ['customer', 'owner', 'interviews', 'interviews.creator'],
      })
    })

    it('should throw NotFoundException for non-existent case', async () => {
      caseRepo.findOne.mockResolvedValue(null)

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      )
    })
  })

  describe('update', () => {
    it('should update case fields', async () => {
      const mockCase = createMockCase()
      caseRepo.findOne.mockResolvedValue(mockCase)

      const updated = { ...mockCase, caseName: '更新案件' }
      caseRepo.save.mockResolvedValue(updated)
      caseRepo.findOne
        .mockResolvedValueOnce(mockCase)
        .mockResolvedValueOnce(updated)

      const result = await service.update(
        'case-1',
        { caseName: '更新案件' },
        'user-2',
      )

      expect(result.caseName).toBe('更新案件')
    })
  })

  describe('remove', () => {
    it('should soft-delete a case', async () => {
      const mockCase = createMockCase()
      caseRepo.findOne.mockResolvedValue(mockCase)

      await service.remove('case-1')
      expect(caseRepo.softRemove).toHaveBeenCalledWith(mockCase)
    })

    it('should throw for non-existent case', async () => {
      caseRepo.findOne.mockResolvedValue(null)

      await expect(service.remove('nonexistent')).rejects.toThrow(
        NotFoundException,
      )
    })
  })

  // ── Status Transitions ────────────────────────────────

  describe('updateStatus', () => {
    it('should transition DRAFT → ACCEPTED', async () => {
      const mockCase = createMockCase({ status: AdminCaseStatus.DRAFT })
      caseRepo.findOne.mockResolvedValue(mockCase)
      caseRepo.save.mockResolvedValue({
        ...mockCase,
        status: AdminCaseStatus.ACCEPTED,
      })

      const result = await service.updateStatus(
        'case-1',
        AdminCaseStatus.ACCEPTED,
        'user-1',
      )

      expect(caseRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: AdminCaseStatus.ACCEPTED }),
      )
    })

    it('should transition DRAFT → CANCELLED', async () => {
      const mockCase = createMockCase({ status: AdminCaseStatus.DRAFT })
      caseRepo.findOne.mockResolvedValue(mockCase)

      await service.updateStatus('case-1', AdminCaseStatus.CANCELLED, 'user-1')

      expect(caseRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: AdminCaseStatus.CANCELLED }),
      )
    })

    it('should transition ACCEPTED → MATERIAL_PENDING', async () => {
      const mockCase = createMockCase({ status: AdminCaseStatus.ACCEPTED })
      caseRepo.findOne.mockResolvedValue(mockCase)

      await service.updateStatus(
        'case-1',
        AdminCaseStatus.MATERIAL_PENDING,
        'user-1',
      )

      expect(caseRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: AdminCaseStatus.MATERIAL_PENDING }),
      )
    })

    it('should transition SUBMITTED → APPROVED', async () => {
      const mockCase = createMockCase({ status: AdminCaseStatus.SUBMITTED })
      caseRepo.findOne.mockResolvedValue(mockCase)

      await service.updateStatus(
        'case-1',
        AdminCaseStatus.APPROVED,
        'user-1',
      )

      expect(caseRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: AdminCaseStatus.APPROVED }),
      )
    })

    it('should transition SUBMITTED → REJECTED', async () => {
      const mockCase = createMockCase({ status: AdminCaseStatus.SUBMITTED })
      caseRepo.findOne.mockResolvedValue(mockCase)

      await service.updateStatus(
        'case-1',
        AdminCaseStatus.REJECTED,
        'user-1',
      )

      expect(caseRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: AdminCaseStatus.REJECTED }),
      )
    })

    it('should allow REJECTED → MATERIAL_PENDING (retry)', async () => {
      const mockCase = createMockCase({ status: AdminCaseStatus.REJECTED })
      caseRepo.findOne.mockResolvedValue(mockCase)

      await service.updateStatus(
        'case-1',
        AdminCaseStatus.MATERIAL_PENDING,
        'user-1',
      )

      expect(caseRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: AdminCaseStatus.MATERIAL_PENDING }),
      )
    })

    it('should reject invalid transition DRAFT → COMPLETED', async () => {
      const mockCase = createMockCase({ status: AdminCaseStatus.DRAFT })
      caseRepo.findOne.mockResolvedValue(mockCase)

      await expect(
        service.updateStatus('case-1', AdminCaseStatus.COMPLETED, 'user-1'),
      ).rejects.toThrow(BadRequestException)
    })

    it('should reject transition from terminal COMPLETED', async () => {
      const mockCase = createMockCase({ status: AdminCaseStatus.COMPLETED })
      caseRepo.findOne.mockResolvedValue(mockCase)

      await expect(
        service.updateStatus('case-1', AdminCaseStatus.DRAFT, 'user-1'),
      ).rejects.toThrow(BadRequestException)
    })

    it('should reject transition from terminal CANCELLED', async () => {
      const mockCase = createMockCase({ status: AdminCaseStatus.CANCELLED })
      caseRepo.findOne.mockResolvedValue(mockCase)

      await expect(
        service.updateStatus('case-1', AdminCaseStatus.DRAFT, 'user-1'),
      ).rejects.toThrow(BadRequestException)
    })

    it('should reject APPROVED → REJECTED (skip invalid)', async () => {
      const mockCase = createMockCase({ status: AdminCaseStatus.APPROVED })
      caseRepo.findOne.mockResolvedValue(mockCase)

      await expect(
        service.updateStatus('case-1', AdminCaseStatus.REJECTED, 'user-1'),
      ).rejects.toThrow(BadRequestException)
    })
  })

  describe('getAvailableTransitions', () => {
    it('should return valid transitions for DRAFT', () => {
      const result = service.getAvailableTransitions(AdminCaseStatus.DRAFT)
      expect(result).toEqual([AdminCaseStatus.ACCEPTED, AdminCaseStatus.CANCELLED])
    })

    it('should return empty for COMPLETED', () => {
      const result = service.getAvailableTransitions(AdminCaseStatus.COMPLETED)
      expect(result).toEqual([])
    })

    it('should return empty for CANCELLED', () => {
      const result = service.getAvailableTransitions(AdminCaseStatus.CANCELLED)
      expect(result).toEqual([])
    })

    it('should return MATERIAL_PENDING and CANCELLED for REJECTED', () => {
      const result = service.getAvailableTransitions(AdminCaseStatus.REJECTED)
      expect(result).toEqual([
        AdminCaseStatus.MATERIAL_PENDING,
        AdminCaseStatus.CANCELLED,
      ])
    })
  })

  // ── Interviews ────────────────────────────────────────

  describe('createInterview', () => {
    it('should create interview linked to a case', async () => {
      const mockCase = createMockCase()
      caseRepo.findOne.mockResolvedValue(mockCase)

      const mockInterview = createMockInterview({ id: 'iv-new' })
      interviewRepo.save.mockResolvedValue(mockInterview)
      interviewRepo.findOne.mockResolvedValue(mockInterview)

      const result = await service.createInterview(
        'case-1',
        {
          interviewDate: '2026-03-15',
          content: '面談内容テスト',
          interviewLocation: '事務所',
        },
        'user-1',
      )

      expect(interviewRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          adminCaseId: 'case-1',
          customerId: 'customer-1',
          content: '面談内容テスト',
        }),
      )
      expect(result).toBeDefined()
    })

    it('should throw if case not found', async () => {
      caseRepo.findOne.mockResolvedValue(null)

      await expect(
        service.createInterview(
          'nonexistent',
          { interviewDate: '2026-03-15', content: 'test' },
          'user-1',
        ),
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe('findInterview', () => {
    it('should return interview with creator', async () => {
      const mockInterview = createMockInterview()
      interviewRepo.findOne.mockResolvedValue(mockInterview)

      const result = await service.findInterview('iv-1')
      expect(result.id).toBe('iv-1')
    })

    it('should throw for non-existent interview', async () => {
      interviewRepo.findOne.mockResolvedValue(null)

      await expect(service.findInterview('nonexistent')).rejects.toThrow(
        NotFoundException,
      )
    })
  })

  describe('updateInterview', () => {
    it('should update interview content', async () => {
      const mockInterview = createMockInterview()
      interviewRepo.findOne.mockResolvedValue(mockInterview)

      const updated = { ...mockInterview, content: '更新内容' }
      interviewRepo.save.mockResolvedValue(updated)
      interviewRepo.findOne
        .mockResolvedValueOnce(mockInterview)
        .mockResolvedValueOnce(updated)

      const result = await service.updateInterview(
        'iv-1',
        { content: '更新内容' },
        'user-1',
      )

      expect(result.content).toBe('更新内容')
    })
  })

  describe('removeInterview', () => {
    it('should soft-delete interview', async () => {
      const mockInterview = createMockInterview()
      interviewRepo.findOne.mockResolvedValue(mockInterview)

      await service.removeInterview('iv-1')
      expect(interviewRepo.softRemove).toHaveBeenCalledWith(mockInterview)
    })

    it('should throw for non-existent interview', async () => {
      interviewRepo.findOne.mockResolvedValue(null)

      await expect(service.removeInterview('nonexistent')).rejects.toThrow(
        NotFoundException,
      )
    })
  })

  // ── Documents ────────────────────────────────────────

  describe('findDocuments', () => {
    it('should return documents for a case', async () => {
      const mockCase = createMockCase()
      caseRepo.findOne.mockResolvedValue(mockCase)
      const mockDocs = [createMockDocument()]
      documentRepo.find.mockResolvedValue(mockDocs)

      const result = await service.findDocuments('case-1')
      expect(result).toHaveLength(1)
      expect(documentRepo.find).toHaveBeenCalledWith({
        where: { adminCaseId: 'case-1' },
        relations: ['file', 'file.uploader'],
        order: { createdAt: 'DESC' },
      })
    })

    it('should throw if case not found', async () => {
      caseRepo.findOne.mockResolvedValue(null)

      await expect(service.findDocuments('nonexistent')).rejects.toThrow(
        NotFoundException,
      )
    })
  })

  describe('createDocument', () => {
    it('should create a document linked to a case and file', async () => {
      const mockCase = createMockCase()
      caseRepo.findOne.mockResolvedValue(mockCase)

      const mockDoc = createMockDocument({ id: 'doc-new' })
      documentRepo.save.mockResolvedValue(mockDoc)
      documentRepo.findOne.mockResolvedValue(mockDoc)

      const result = await service.createDocument('case-1', {
        fileId: 'file-1',
        documentType: '申請書',
        remark: 'テスト備考',
      })

      expect(documentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          adminCaseId: 'case-1',
          fileId: 'file-1',
          documentType: '申請書',
          remark: 'テスト備考',
        }),
      )
      expect(result).toBeDefined()
    })

    it('should create document without optional fields', async () => {
      const mockCase = createMockCase()
      caseRepo.findOne.mockResolvedValue(mockCase)

      const mockDoc = createMockDocument({ id: 'doc-new', documentType: null, remark: null })
      documentRepo.save.mockResolvedValue(mockDoc)
      documentRepo.findOne.mockResolvedValue(mockDoc)

      await service.createDocument('case-1', { fileId: 'file-1' })

      expect(documentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          adminCaseId: 'case-1',
          fileId: 'file-1',
          documentType: null,
          remark: null,
        }),
      )
    })

    it('should throw if case not found', async () => {
      caseRepo.findOne.mockResolvedValue(null)

      await expect(
        service.createDocument('nonexistent', { fileId: 'file-1' }),
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe('findDocument', () => {
    it('should return document with file relation', async () => {
      const mockDoc = createMockDocument()
      documentRepo.findOne.mockResolvedValue(mockDoc)

      const result = await service.findDocument('doc-1')
      expect(result.id).toBe('doc-1')
      expect(documentRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
        relations: ['file', 'file.uploader'],
      })
    })

    it('should throw for non-existent document', async () => {
      documentRepo.findOne.mockResolvedValue(null)

      await expect(service.findDocument('nonexistent')).rejects.toThrow(
        NotFoundException,
      )
    })
  })

  describe('updateDocument', () => {
    it('should update document type and remark', async () => {
      const mockDoc = createMockDocument()
      documentRepo.findOne.mockResolvedValue(mockDoc)

      const updated = { ...mockDoc, documentType: '在留カード', remark: '更新備考' }
      documentRepo.save.mockResolvedValue(updated)
      documentRepo.findOne
        .mockResolvedValueOnce(mockDoc)
        .mockResolvedValueOnce(updated)

      const result = await service.updateDocument('doc-1', {
        documentType: '在留カード',
        remark: '更新備考',
      })

      expect(result.documentType).toBe('在留カード')
      expect(result.remark).toBe('更新備考')
    })
  })

  describe('removeDocument', () => {
    it('should remove a document', async () => {
      const mockDoc = createMockDocument()
      documentRepo.findOne.mockResolvedValue(mockDoc)

      await service.removeDocument('doc-1')
      expect(documentRepo.remove).toHaveBeenCalledWith(mockDoc)
    })

    it('should throw for non-existent document', async () => {
      documentRepo.findOne.mockResolvedValue(null)

      await expect(service.removeDocument('nonexistent')).rejects.toThrow(
        NotFoundException,
      )
    })
  })

  describe('toDocumentDto', () => {
    it('should map document with file info', () => {
      const mockDoc = createMockDocument()
      const dto = service.toDocumentDto(mockDoc)

      expect(dto.id).toBe('doc-1')
      expect(dto.fileId).toBe('file-1')
      expect(dto.documentType).toBe('申請書')
      expect(dto.file).not.toBeNull()
      expect(dto.file!.fileName).toBe('test.pdf')
      expect(dto.file!.uploaderName).toBe('担当者A')
    })

    it('should handle null file', () => {
      const mockDoc = createMockDocument({ file: null as any })
      const dto = service.toDocumentDto(mockDoc)

      expect(dto.file).toBeNull()
    })
  })
})
