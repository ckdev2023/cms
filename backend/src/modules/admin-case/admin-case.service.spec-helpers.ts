import { AdminCaseStatus } from '../../common/constants/enums';
import { User } from '../auth/entities/user.entity';
import { Customer } from '../customer/entities/customer.entity';
import { FileEntity } from '../file/entities/file.entity';
import { AdminCase } from './entities/admin-case.entity';
import { AdminCaseDocument } from './entities/admin-case-document.entity';
import { AdminCaseInterview } from './entities/admin-case-interview.entity';

export type MockRepository = Record<string, jest.Mock>;

export type TestRepositories = {
  caseRepo: MockRepository;
  interviewRepo: MockRepository;
  documentRepo: MockRepository;
};

export function createMockCase(overrides: Partial<AdminCase> = {}): AdminCase {
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
    customer: { id: 'customer-1', customerName: 'テスト顧客' } as Customer,
    owner: { id: 'user-1', displayName: '担当者A' } as User,
    interviews: [],
    documents: [],
    tasks: [],
    ...overrides,
  } as AdminCase;
}

export function createMockInterview(
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
    adminCase: {} as AdminCase,
    customer: {} as Customer,
    creator: { id: 'user-1', displayName: '担当者A' } as User,
    ...overrides,
  } as AdminCaseInterview;
}

export function createMockDocument(
  overrides: Partial<AdminCaseDocument> = {},
): AdminCaseDocument {
  return {
    id: 'doc-1',
    adminCaseId: 'case-1',
    fileId: 'file-1',
    documentType: '申請書',
    remark: 'テスト備考',
    createdAt: new Date(),
    adminCase: {} as AdminCase,
    file: {
      id: 'file-1',
      fileName: 'test.pdf',
      fileExt: '.pdf',
      fileSize: 12345,
      mimeType: 'application/pdf',
      description: null,
      uploader: { displayName: '担当者A' } as User,
      createdAt: new Date(),
    } as FileEntity,
    ...overrides,
  } as AdminCaseDocument;
}

export function createMockRepositories(): TestRepositories {
  return {
    caseRepo: {
      create: jest.fn().mockImplementation((payload: Partial<AdminCase>) => ({
        ...payload,
        id: 'case-new',
      })),
      save: jest
        .fn()
        .mockImplementation((entity: AdminCase) => Promise.resolve(entity)),
      findOne: jest.fn(),
      softRemove: jest.fn().mockResolvedValue(undefined),
      recover: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn(),
    },
    interviewRepo: {
      create: jest
        .fn()
        .mockImplementation((payload: Partial<AdminCaseInterview>) => ({
          ...payload,
          id: 'iv-new',
        })),
      save: jest
        .fn()
        .mockImplementation((entity: AdminCaseInterview) =>
          Promise.resolve(entity),
        ),
      findOne: jest.fn(),
      softRemove: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn(),
    },
    documentRepo: {
      create: jest
        .fn()
        .mockImplementation((payload: Partial<AdminCaseDocument>) => ({
          ...payload,
          id: 'doc-new',
        })),
      save: jest
        .fn()
        .mockImplementation((entity: AdminCaseDocument) =>
          Promise.resolve(entity),
        ),
      find: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn().mockResolvedValue(undefined),
    },
  };
}
