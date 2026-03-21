import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { ConfigService } from '@nestjs/config'
import { NotFoundException } from '@nestjs/common'
import { FileService } from './file.service'
import { FileEntity } from './entities/file.entity'
import { FileAccessLog } from './entities/file-access-log.entity'
import { BusinessType } from '../../common/constants/enums'

function createMockFile(overrides: Partial<FileEntity> = {}): FileEntity {
  return {
    id: 'file-1',
    customerId: 'customer-1',
    businessType: BusinessType.CUSTOMER,
    relatedId: null,
    fileName: 'test.pdf',
    description: null,
    filePath: 'CUSTOMER/2026/03/uuid.pdf',
    fileExt: '.pdf',
    fileSize: 12345,
    mimeType: 'application/pdf',
    uploadedBy: 'user-1',
    uploader: { displayName: '担当者A' } as any,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  } as FileEntity
}

describe('FileService – association filtering', () => {
  let service: FileService
  let fileRepo: Record<string, jest.Mock>
  let accessLogRepo: Record<string, jest.Mock>

  const mockQb = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  }

  beforeEach(async () => {
    fileRepo = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(mockQb),
    }
    accessLogRepo = {
      create: jest.fn().mockImplementation((d) => d),
      save: jest.fn().mockResolvedValue(undefined),
    }

    Object.values(mockQb).forEach((fn) => {
      if (typeof fn === 'function' && 'mockClear' in fn) fn.mockClear()
    })
    mockQb.leftJoinAndSelect.mockReturnValue(mockQb)
    mockQb.andWhere.mockReturnValue(mockQb)
    mockQb.orderBy.mockReturnValue(mockQb)
    mockQb.skip.mockReturnValue(mockQb)
    mockQb.take.mockReturnValue(mockQb)

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileService,
        { provide: getRepositoryToken(FileEntity), useValue: fileRepo },
        { provide: getRepositoryToken(FileAccessLog), useValue: accessLogRepo },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string, def: any) => def),
          },
        },
      ],
    }).compile()

    service = module.get<FileService>(FileService)
  })

  describe('findAll with customerId filter', () => {
    it('should apply customerId filter when provided', async () => {
      const files = [createMockFile()]
      mockQb.getManyAndCount.mockResolvedValue([files, 1])

      await service.findAll({
        businessType: BusinessType.CUSTOMER,
        customerId: 'customer-1',
      })

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'f.businessType = :bt',
        { bt: BusinessType.CUSTOMER },
      )
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'f.customerId = :cid',
        { cid: 'customer-1' },
      )
    })
  })

  describe('findAll with relatedId filter', () => {
    it('should apply relatedId filter when provided', async () => {
      const files = [
        createMockFile({
          businessType: BusinessType.ADMIN,
          relatedId: 'case-1',
        }),
      ]
      mockQb.getManyAndCount.mockResolvedValue([files, 1])

      await service.findAll({
        businessType: BusinessType.ADMIN,
        relatedId: 'case-1',
      })

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'f.businessType = :bt',
        { bt: BusinessType.ADMIN },
      )
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'f.relatedId = :rid',
        { rid: 'case-1' },
      )
    })
  })

  describe('findAll with combined filters', () => {
    it('should apply customerId + relatedId + businessType together', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0])

      await service.findAll({
        businessType: BusinessType.TAX,
        customerId: 'customer-1',
        relatedId: 'contract-1',
      })

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'f.businessType = :bt',
        { bt: BusinessType.TAX },
      )
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'f.customerId = :cid',
        { cid: 'customer-1' },
      )
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'f.relatedId = :rid',
        { rid: 'contract-1' },
      )
    })
  })

  describe('findAll without filters', () => {
    it('should not apply relatedId/customerId filters when not provided', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0])

      await service.findAll({ page: 1, pageSize: 20 })

      const andWhereCalls = mockQb.andWhere.mock.calls.map(
        (c: any[]) => c[0],
      )
      expect(andWhereCalls).not.toContain('f.relatedId = :rid')
      expect(andWhereCalls).not.toContain('f.customerId = :cid')
    })
  })

  describe('findAll result mapping', () => {
    it('should map file entities to response DTOs', async () => {
      const files = [createMockFile()]
      mockQb.getManyAndCount.mockResolvedValue([files, 1])

      const result = await service.findAll({
        businessType: BusinessType.CUSTOMER,
        customerId: 'customer-1',
      })

      expect(result.items).toHaveLength(1)
      expect(result.items[0]).toMatchObject({
        id: 'file-1',
        customerId: 'customer-1',
        fileName: 'test.pdf',
        uploaderName: '担当者A',
      })
      expect(result.total).toBe(1)
    })
  })

  describe('findOne', () => {
    it('should return file by id', async () => {
      const file = createMockFile()
      fileRepo.findOne.mockResolvedValue(file)

      const result = await service.findOne('file-1')
      expect(result.id).toBe('file-1')
    })

    it('should throw NotFoundException for non-existent file', async () => {
      fileRepo.findOne.mockResolvedValue(null)

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      )
    })
  })
})
