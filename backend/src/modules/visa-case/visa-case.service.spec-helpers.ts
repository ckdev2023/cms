import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import {
  FamilyLinkMode,
  FilePathType,
  VisaCaseLogType,
  VisaCaseMemberRole,
  VisaCaseStatus,
  VisaDataScope,
} from '../../common/constants/enums';
import { Customer } from '../customer/entities/customer.entity';
import { Note } from '../customer/entities/note.entity';
import { CreateVisaCaseDto } from './dto/create-visa-case.dto';
import { CreateVisaCaseLogDto } from './dto/create-visa-case-log.dto';
import { CustomerFilePath } from './entities/customer-file-path.entity';
import { MaterialTemplate } from './entities/material-template.entity';
import { MaterialTemplateItem } from './entities/material-template-item.entity';
import { VisaCase } from './entities/visa-case.entity';
import { VisaCaseFamilyMember } from './entities/visa-case-family-member.entity';
import { VisaCaseMaterialItem } from './entities/visa-case-material-item.entity';
import { MaterialTemplateService } from './material-template.service';
import { VisaCaseService } from './visa-case.service';
import { VisaCaseDataScopeService } from './visa-case-data-scope.service';
import { VisaCaseDataScopePermissionService } from './visa-case-data-scope-permission.service';
import { VisaCaseFamilyMemberService } from './visa-case-family-member.service';
import { VisaCaseFilePathService } from './visa-case-file-path.service';
import { VisaCaseInternalPrimaryService } from './visa-case-internal-primary.service';
import { VisaCaseLogService } from './visa-case-log.service';
import { VisaCaseLookupService } from './visa-case-lookup.service';
import { VisaCaseMaterialService } from './visa-case-material.service';
import { VisaCaseReminderService } from './visa-case-reminder.service';
import { VisaCaseReminderDomainStatsService } from './visa-case-reminder-domain-stats.service';
import { VisaCaseSupplementLogCaseIdsService } from './visa-case-supplement-log-case-ids.service';

/** 测试双：`jest.Mock<any,any,any>`，保证 `mockResolvedValue` 等与 Jest 30 类型一致且可被类型服务解析。 */
export type JestMockFn = jest.Mock<any, any, any>;

export type RepoMock<TMethodName extends string> = Record<
  TMethodName,
  JestMockFn
>;

export type VisaCaseRepoMock = RepoMock<
  'create' | 'save' | 'findOne' | 'find' | 'count' | 'createQueryBuilder'
>;
export type FamilyMemberRepoMock = RepoMock<
  'create' | 'save' | 'find' | 'findOne' | 'remove'
>;
export type CustomerRepoMock = RepoMock<'count' | 'findOne'>;
export type NoteRepoMock = RepoMock<
  'create' | 'save' | 'findOne' | 'softRemove' | 'createQueryBuilder'
> & {
  manager: { query: JestMockFn };
};
export type FilePathRepoMock = RepoMock<
  'create' | 'save' | 'findOne' | 'softRemove' | 'createQueryBuilder'
>;

export type QueryBuilderMock = RepoMock<
  | 'leftJoinAndSelect'
  | 'where'
  | 'andWhere'
  | 'orderBy'
  | 'addOrderBy'
  | 'addSelect'
  | 'setParameter'
  | 'groupBy'
  | 'skip'
  | 'take'
  | 'getManyAndCount'
  | 'getMany'
>;

export type ServiceTestContext = {
  module: TestingModule;
  service: VisaCaseService;
  visaCaseRepo: VisaCaseRepoMock;
  familyMemberRepo: FamilyMemberRepoMock;
  customerRepo: CustomerRepoMock;
  noteRepo: NoteRepoMock;
  filePathRepo: FilePathRepoMock;
  /** `VisaCaseDataScopeService.resolve` mock，供 F1a 等测例断言列表与统计共用同一 `dataScope` 解析入参 */
  dataScopeResolve: JestMockFn;
};

export type ContextAccessor = () => ServiceTestContext;

/** `ensureVisaCaseRowAccessById` 用最小行，assignedTo 可按测例覆盖 */
export const MOCK_VISA_CASE_SCOPE_ROW = {
  id: 'vc-1',
  assignedTo: null as string | null,
};

export const PRIMARY_CUSTOMER = {
  id: 'cust-primary',
  customerName: '田中太郎',
};
export const UPDATED_PRIMARY_CUSTOMER = {
  id: 'cust-new',
  customerName: '山田花子',
};

export function buildPrimaryApplicantMember(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    id: 'fm-1',
    customerId: 'cust-primary',
    customer: { customerName: '田中太郎' },
    memberRole: VisaCaseMemberRole.APPLICANT,
    isPrimary: true,
    displayNameSnapshot: '田中太郎',
    ...overrides,
  };
}

export function buildInternalPrimaryVisaCaseRecord(
  primaryCustomerId = 'cust-primary',
  primaryCustomerName = '田中太郎',
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return buildVisaCaseRecord({
    isFamilyCase: true,
    familyLinkMode: FamilyLinkMode.INTERNAL,
    internalPrimaryCustomerId: primaryCustomerId,
    internalPrimaryCustomer: { customerName: primaryCustomerName },
    familyMembers: [
      buildPrimaryApplicantMember({
        customerId: primaryCustomerId,
        customer: { customerName: primaryCustomerName },
        displayNameSnapshot: primaryCustomerName,
      }),
    ],
    ...overrides,
  });
}

export function buildInternalPrimaryCreatePayload(
  overrides: Partial<CreateVisaCaseDto> = {},
): CreateVisaCaseDto {
  return {
    customerId: 'cust-1',
    isFamilyCase: true,
    familyLinkMode: FamilyLinkMode.INTERNAL,
    internalPrimaryCustomerId: 'cust-primary',
    ...overrides,
  };
}

export function buildInternalFamilyCaseWithoutMembers(
  primaryCustomerId = 'cust-primary',
): Record<string, unknown> {
  return buildVisaCaseRecord({
    isFamilyCase: true,
    familyLinkMode: FamilyLinkMode.INTERNAL,
    internalPrimaryCustomerId: primaryCustomerId,
    familyMembers: [],
  });
}

export function buildVisaCaseRecord(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    id: 'vc-1',
    customerId: 'cust-1',
    caseType: null,
    caseStatus: VisaCaseStatus.DRAFT,
    isFamilyCase: false,
    familyLinkMode: null,
    internalPrimaryCustomerId: null,
    internalPrimaryCustomer: null,
    externalPrimaryName: null,
    externalPrimaryCaseType: null,
    externalPrimaryExpireDate: null,
    externalPrimaryRelationToApplicant: null,
    assignedTo: null,
    expireDate: null,
    nextFollowUpAt: null,
    materialStatus: null,
    feeStatus: null,
    memo: null,
    createdBy: 'user-1',
    updatedBy: 'user-1',
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    assignee: null,
    creator: null,
    familyMembers: [],
    ...overrides,
  };
}

export function buildExternalPrimaryVisaCaseRecord(
  name = '外部太郎',
  caseType: string | null = '技術・人文知識・国際業務',
  expireDate: string | null = '2027-06-30',
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return buildVisaCaseRecord({
    isFamilyCase: true,
    familyLinkMode: FamilyLinkMode.EXTERNAL,
    externalPrimaryName: name,
    externalPrimaryCaseType: caseType,
    externalPrimaryExpireDate: expireDate,
    ...overrides,
  });
}

export function buildExternalPrimaryCreatePayload(
  overrides: Partial<CreateVisaCaseDto> = {},
): CreateVisaCaseDto {
  return {
    customerId: 'cust-1',
    isFamilyCase: true,
    familyLinkMode: FamilyLinkMode.EXTERNAL,
    externalPrimaryName: '外部太郎',
    ...overrides,
  } as CreateVisaCaseDto;
}

export function createQueryBuilderMock(
  result: [Array<Record<string, unknown>>, number],
): QueryBuilderMock {
  return {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue(result),
    getMany: jest.fn().mockResolvedValue(result[0]),
  };
}

export function createVisaCaseRepoMock(): VisaCaseRepoMock {
  return {
    create: jest
      .fn()
      .mockImplementation((data: Partial<VisaCase>) =>
        buildVisaCaseRecord({ id: 'vc-new', ...data }),
      ),
    save: jest
      .fn()
      .mockImplementation(async (entity: VisaCase) => Promise.resolve(entity)),
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(1),
    createQueryBuilder: jest.fn(),
  };
}

export function createFamilyMemberRepoMock(): FamilyMemberRepoMock {
  return {
    create: jest
      .fn()
      .mockImplementation(
        (data: Partial<VisaCaseFamilyMember>) =>
          ({ id: 'fm-1', ...data }) as VisaCaseFamilyMember,
      ),
    save: jest
      .fn()
      .mockImplementation(async (entity: VisaCaseFamilyMember) =>
        Promise.resolve(entity),
      ),
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    remove: jest.fn().mockResolvedValue(undefined),
  };
}

export function createCustomerRepoMock(): CustomerRepoMock {
  return {
    count: jest.fn().mockResolvedValue(1),
    findOne: jest
      .fn()
      .mockResolvedValue({ id: 'cust-primary', customerName: '田中太郎' }),
  };
}

export function createNoteRepoMock(): NoteRepoMock {
  return {
    create: jest.fn().mockImplementation((data: Partial<Note>) => ({
      id: 'log-new',
      ...data,
    })),
    save: jest
      .fn()
      .mockImplementation(async (entity: Note) => Promise.resolve(entity)),
    findOne: jest.fn().mockResolvedValue(null),
    softRemove: jest.fn().mockResolvedValue(undefined),
    createQueryBuilder: jest.fn(),
    manager: { query: jest.fn().mockResolvedValue([]) },
  };
}

export function createFilePathRepoMock(): FilePathRepoMock {
  return {
    create: jest.fn().mockImplementation((data: Partial<CustomerFilePath>) => ({
      id: 'fp-new',
      ...data,
    })),
    save: jest
      .fn()
      .mockImplementation(async (entity: CustomerFilePath) =>
        Promise.resolve(entity),
      ),
    findOne: jest.fn().mockResolvedValue(null),
    softRemove: jest.fn().mockResolvedValue(undefined),
    createQueryBuilder: jest.fn(),
  };
}

export function buildFilePathRecord(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    id: 'fp-1',
    customerId: 'cust-1',
    visaCaseId: null,
    pathType: FilePathType.OTHER,
    filePath: '/nas/customers/001/docs',
    displayName: 'テスト資料',
    remark: null,
    createdBy: 'user-1',
    creator: { displayName: 'テスト管理者' },
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createMaterialItemRepoMock(): RepoMock<
  'create' | 'save' | 'find' | 'findOne' | 'count' | 'remove' | 'update'
> {
  return {
    create: jest.fn().mockImplementation((data: unknown) => data),
    save: jest
      .fn()
      .mockImplementation((entity: unknown) => Promise.resolve(entity)),
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    count: jest.fn().mockResolvedValue(0),
    remove: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
}

function createTemplateRepoMock(): RepoMock<
  'find' | 'findOne' | 'create' | 'save' | 'softRemove'
> {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((data: unknown) => data),
    save: jest
      .fn()
      .mockImplementation((entity: unknown) => Promise.resolve(entity)),
    softRemove: jest.fn().mockResolvedValue(undefined),
  };
}

function createTemplateItemRepoMock(): RepoMock<'create' | 'save' | 'delete'> {
  return {
    create: jest.fn().mockImplementation((data: unknown) => data),
    save: jest
      .fn()
      .mockImplementation((entity: unknown) => Promise.resolve(entity)),
    delete: jest.fn().mockResolvedValue({ affected: 0 }),
  };
}

export async function createTestingContext(): Promise<ServiceTestContext> {
  const visaCaseRepo = createVisaCaseRepoMock();
  const familyMemberRepo = createFamilyMemberRepoMock();
  const customerRepo = createCustomerRepoMock();
  const noteRepo = createNoteRepoMock();
  const filePathRepo = createFilePathRepoMock();
  const materialItemRepo = createMaterialItemRepoMock();
  const templateRepo = createTemplateRepoMock();
  const templateItemRepo = createTemplateItemRepoMock();
  const dataScopeResolve = jest.fn().mockResolvedValue({ mode: 'all' });
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      VisaCaseLookupService,
      VisaCaseInternalPrimaryService,
      VisaCaseFamilyMemberService,
      VisaCaseLogService,
      VisaCaseFilePathService,
      {
        provide: VisaCaseDataScopeService,
        useValue: {
          resolve: dataScopeResolve,
        },
      },
      {
        provide: VisaCaseDataScopePermissionService,
        useValue: {
          loadPermissionCodesForUser: jest.fn().mockResolvedValue(new Set()),
          getMaxAllowedVisaDataScope: jest
            .fn()
            .mockReturnValue(VisaDataScope.ALL),
          assertQueryDataScopeAllowed: jest.fn(),
          assertVisaCaseRowAccessible: jest.fn().mockResolvedValue(undefined),
        },
      },
      VisaCaseSupplementLogCaseIdsService,
      VisaCaseReminderDomainStatsService,
      VisaCaseReminderService,
      MaterialTemplateService,
      VisaCaseMaterialService,
      VisaCaseService,
      { provide: getRepositoryToken(VisaCase), useValue: visaCaseRepo },
      {
        provide: getRepositoryToken(VisaCaseFamilyMember),
        useValue: familyMemberRepo,
      },
      { provide: getRepositoryToken(Customer), useValue: customerRepo },
      { provide: getRepositoryToken(Note), useValue: noteRepo },
      {
        provide: getRepositoryToken(CustomerFilePath),
        useValue: filePathRepo,
      },
      {
        provide: getRepositoryToken(VisaCaseMaterialItem),
        useValue: materialItemRepo,
      },
      {
        provide: getRepositoryToken(MaterialTemplate),
        useValue: templateRepo,
      },
      {
        provide: getRepositoryToken(MaterialTemplateItem),
        useValue: templateItemRepo,
      },
    ],
  }).compile();

  return {
    module,
    service: module.get<VisaCaseService>(VisaCaseService),
    visaCaseRepo,
    familyMemberRepo,
    customerRepo,
    noteRepo,
    filePathRepo,
    dataScopeResolve,
  };
}

export function buildFamilyMember(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    id: 'fm-spouse',
    visaCaseId: 'vc-1',
    customerId: 'cust-spouse',
    customer: { customerName: '田中花子' },
    memberRole: VisaCaseMemberRole.SPOUSE,
    isPrimary: false,
    displayNameSnapshot: '田中花子',
    createdAt: new Date('2024-01-02T00:00:00.000Z'),
    ...overrides,
  };
}

export function buildNoteRecord(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    id: 'log-1',
    customerId: 'cust-1',
    visaCaseId: 'vc-1',
    logType: VisaCaseLogType.GENERAL,
    content: 'テストログ',
    submittedItems: null,
    missingItems: null,
    nextAction: null,
    nextFollowUpAt: null,
    createdBy: 'user-1',
    creator: { displayName: 'テスト管理者' },
    createdAt: new Date('2024-02-01T00:00:00.000Z'),
    updatedAt: new Date('2024-02-01T00:00:00.000Z'),
    ...overrides,
  };
}

export function buildLogCreatePayload(
  overrides: Partial<CreateVisaCaseLogDto> = {},
): CreateVisaCaseLogDto {
  return {
    logType: VisaCaseLogType.GENERAL,
    content: 'テストログ内容',
    ...overrides,
  };
}

export function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

export function buildReminderCase(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return buildVisaCaseRecord({
    customer: { customerName: 'テスト顧客' },
    ...overrides,
  });
}
