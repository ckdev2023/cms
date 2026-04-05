import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import {
  AuditActionType,
  AuditTargetType,
  ExportType,
  LoginType,
  OperationResult,
} from '../../common/constants/enums';
import { AuditLog } from './entities/audit-log.entity';
import { ExportLog } from './entities/export-log.entity';
import { LoginLog } from './entities/login-log.entity';
import { LogService } from './log.service';

type MockQueryBuilder = {
  addSelect: jest.Mock;
  andWhere: jest.Mock;
  getManyAndCount: jest.Mock;
  leftJoin: jest.Mock;
  orderBy: jest.Mock;
  skip: jest.Mock;
  take: jest.Mock;
};

type MockRepository = {
  create: jest.Mock;
  createQueryBuilder: jest.Mock;
  save: jest.Mock;
};

type ServiceTestContext = {
  auditLogRepo: MockRepository;
  loginLogRepo: MockRepository;
  exportLogRepo: MockRepository;
  service: LogService;
};

function createAuditLogEntity(data: Record<string, unknown>): Record<
  string,
  unknown
> & {
  id: string;
  occurredAt: Date;
} {
  return {
    id: 'log-1',
    occurredAt: new Date(),
    ...data,
  };
}

function returnInputRecord(
  data: Record<string, unknown>,
): Record<string, unknown> {
  return data;
}

function mockQueryBuilder(
  items: unknown[] = [],
  total = 0,
  options: { getMany?: unknown[] } = {},
): MockQueryBuilder & { getMany: jest.Mock } {
  const getManyItems = options.getMany ?? items;
  const qb = {
    leftJoin: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([items, total]),
    getMany: jest.fn().mockResolvedValue(getManyItems),
  };
  return qb;
}

async function createServiceTestContext(): Promise<ServiceTestContext> {
  const auditLogRepo: MockRepository = {
    create: jest.fn().mockImplementation(createAuditLogEntity),
    save: jest.fn().mockImplementation((d) => Promise.resolve(d)),
    createQueryBuilder: jest.fn(),
  };

  const loginLogRepo: MockRepository = {
    create: jest.fn().mockImplementation(returnInputRecord),
    save: jest.fn().mockResolvedValue(undefined),
    createQueryBuilder: jest.fn(),
  };

  const exportLogRepo: MockRepository = {
    create: jest.fn().mockImplementation(returnInputRecord),
    save: jest.fn().mockImplementation((d: unknown) => Promise.resolve(d)),
    createQueryBuilder: jest.fn(),
  };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      LogService,
      { provide: getRepositoryToken(AuditLog), useValue: auditLogRepo },
      { provide: getRepositoryToken(LoginLog), useValue: loginLogRepo },
      { provide: getRepositoryToken(ExportLog), useValue: exportLogRepo },
    ],
  }).compile();

  return {
    service: module.get<LogService>(LogService),
    auditLogRepo,
    loginLogRepo,
    exportLogRepo,
  };
}

describe('LogService createAuditLog', () => {
  let service: LogService;
  let auditLogRepo: MockRepository;

  beforeEach(async () => {
    ({ service, auditLogRepo } = await createServiceTestContext());
  });

  it('should create an audit log entry', async () => {
    const input = {
      userId: 'user-1',
      actionType: AuditActionType.CREATE,
      targetType: AuditTargetType.CUSTOMER,
      targetId: 'cust-1',
      result: OperationResult.SUCCESS,
    };

    const result = await service.createAuditLog(input);

    expect(auditLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        actionType: AuditActionType.CREATE,
        targetType: AuditTargetType.CUSTOMER,
        targetId: 'cust-1',
        result: OperationResult.SUCCESS,
      }),
    );
    expect(auditLogRepo.save).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('should handle null optional fields', async () => {
    const input = {
      userId: null,
      actionType: AuditActionType.LOGIN,
      targetType: AuditTargetType.SYSTEM,
      result: OperationResult.FAILURE,
    };

    await service.createAuditLog(input);

    expect(auditLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: null,
        targetId: null,
        beforeValue: null,
        afterValue: null,
        ipAddress: null,
        deviceInfo: null,
      }),
    );
  });

  it('should persist before/after values', async () => {
    const before = { status: 'DRAFT' };
    const after = { status: 'SENT' };

    await service.createAuditLog({
      userId: 'user-1',
      actionType: AuditActionType.STATUS_CHANGE,
      targetType: AuditTargetType.INVOICE,
      targetId: 'inv-1',
      beforeValue: before,
      afterValue: after,
      result: OperationResult.SUCCESS,
    });

    expect(auditLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        beforeValue: before,
        afterValue: after,
      }),
    );
  });
});

describe('LogService findAuditLogs', () => {
  let service: LogService;
  let auditLogRepo: MockRepository;

  beforeEach(async () => {
    ({ service, auditLogRepo } = await createServiceTestContext());
  });

  it('should return paginated audit logs', async () => {
    const mockLog = {
      id: 'log-1',
      userId: 'user-1',
      actionType: AuditActionType.CREATE,
      targetType: AuditTargetType.CUSTOMER,
      targetId: 'cust-1',
      beforeValue: null,
      afterValue: { name: 'Test' },
      ipAddress: '127.0.0.1',
      deviceInfo: 'TestAgent',
      result: OperationResult.SUCCESS,
      occurredAt: new Date(),
      user: { id: 'user-1', username: 'admin', displayName: '管理者' },
    };

    const qb = mockQueryBuilder([mockLog], 1);
    auditLogRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await service.findAuditLogs({ page: 1, pageSize: 20 });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.items[0].username).toBe('admin');
    expect(result.items[0].actionType).toBe(AuditActionType.CREATE);
  });

  it('should apply filters', async () => {
    const qb = mockQueryBuilder([], 0);
    auditLogRepo.createQueryBuilder.mockReturnValue(qb);

    await service.findAuditLogs({
      page: 1,
      pageSize: 20,
      userId: 'user-1',
      actionType: AuditActionType.DELETE,
      targetType: AuditTargetType.CUSTOMER,
      result: OperationResult.SUCCESS,
      startDate: '2025-01-01T00:00:00Z',
      endDate: '2025-12-31T23:59:59Z',
    });

    expect(qb.andWhere).toHaveBeenCalledTimes(6);
  });

  it('should apply keyword filter', async () => {
    const qb = mockQueryBuilder([], 0);
    auditLogRepo.createQueryBuilder.mockReturnValue(qb);

    await service.findAuditLogs({ page: 1, pageSize: 20, keyword: 'admin' });

    expect(qb.andWhere).toHaveBeenCalledWith(
      '(u.username ILIKE :kw OR u.displayName ILIKE :kw)',
      { kw: '%admin%' },
    );
  });
});

describe('LogService exportAuditLogsAsCsv', () => {
  let service: LogService;
  let auditLogRepo: MockRepository;
  let exportLogRepo: ServiceTestContext['exportLogRepo'];

  beforeEach(async () => {
    ({ service, auditLogRepo, exportLogRepo } =
      await createServiceTestContext());
  });

  it('should return csv rows and record export log', async () => {
    const mockLog = {
      id: 'log-1',
      userId: 'user-1',
      actionType: AuditActionType.CREATE,
      targetType: AuditTargetType.CUSTOMER,
      targetId: 'cust-1',
      beforeValue: null,
      afterValue: { name: 'Test' },
      ipAddress: '127.0.0.1',
      deviceInfo: 'TestAgent',
      result: OperationResult.SUCCESS,
      occurredAt: new Date('2026-01-01T00:00:00.000Z'),
      user: { id: 'user-1', username: 'admin', displayName: '管理者' },
    };

    const qb = mockQueryBuilder([], 0, { getMany: [mockLog] });
    auditLogRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await service.exportAuditLogsAsCsv(
      { limit: 10 },
      'operator-1',
    );

    expect(qb.take).toHaveBeenCalledWith(10);
    expect(qb.getMany).toHaveBeenCalled();
    expect(result.rowCount).toBe(1);
    expect(result.csv).toContain('log-1');
    expect(result.csv).toContain('CREATE');
    expect(exportLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'operator-1',
        exportType: ExportType.AUDIT_LOG_CSV,
        status: OperationResult.SUCCESS,
      }),
    );
    expect(exportLogRepo.save).toHaveBeenCalled();
  });
});

describe('LogService findLoginLogs', () => {
  let service: LogService;
  let loginLogRepo: MockRepository;

  beforeEach(async () => {
    ({ service, loginLogRepo } = await createServiceTestContext());
  });

  it('should return paginated login logs', async () => {
    const mockLog = {
      id: 'llog-1',
      userId: 'user-1',
      username: 'admin',
      loginType: 'LOGIN',
      ipAddress: '127.0.0.1',
      deviceInfo: 'TestAgent',
      result: OperationResult.SUCCESS,
      failureReason: null,
      occurredAt: new Date(),
      user: { id: 'user-1', username: 'admin', displayName: '管理者' },
    };

    const qb = mockQueryBuilder([mockLog], 1);
    loginLogRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await service.findLoginLogs({ page: 1, pageSize: 20 });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.items[0].username).toBe('admin');
  });

  it('should apply login log filters', async () => {
    const qb = mockQueryBuilder([], 0);
    loginLogRepo.createQueryBuilder.mockReturnValue(qb);

    await service.findLoginLogs({
      page: 1,
      pageSize: 20,
      userId: 'user-1',
      username: 'admin',
      loginType: LoginType.LOGIN,
      result: OperationResult.FAILURE,
      startDate: '2025-01-01T00:00:00Z',
      endDate: '2025-12-31T23:59:59Z',
    });

    expect(qb.andWhere).toHaveBeenCalledTimes(6);
  });
});

describe('LogService createExportLog', () => {
  let service: LogService;
  let exportLogRepo: MockRepository;

  beforeEach(async () => {
    ({ service, exportLogRepo } = await createServiceTestContext());
  });

  it('should create an export log entry', async () => {
    const input = {
      userId: 'user-1',
      exportType: ExportType.FILE_ATTACHMENT_STREAM,
      exportParams: { fileId: 'f1', disposition: 'attachment' },
      fileName: 'doc.pdf',
      status: OperationResult.SUCCESS,
    };

    const result = await service.createExportLog(input);

    expect(exportLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        exportType: ExportType.FILE_ATTACHMENT_STREAM,
        fileName: 'doc.pdf',
        status: OperationResult.SUCCESS,
      }),
    );
    expect(exportLogRepo.save).toHaveBeenCalled();
    expect(result).toBeDefined();
  });
});

describe('LogService findExportLogs', () => {
  let service: LogService;
  let exportLogRepo: MockRepository;

  beforeEach(async () => {
    ({ service, exportLogRepo } = await createServiceTestContext());
  });

  it('should return paginated export logs', async () => {
    const mockLog = {
      id: 'ex-1',
      userId: 'user-1',
      exportType: ExportType.FILE_PREVIEW_STREAM,
      exportParams: { fileId: 'f1', disposition: 'inline' },
      fileName: 'a.pdf',
      status: OperationResult.SUCCESS,
      occurredAt: new Date(),
      user: { id: 'user-1', username: 'admin', displayName: '管理者' },
    };

    const qb = mockQueryBuilder([mockLog], 1);
    exportLogRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await service.findExportLogs({ page: 1, pageSize: 20 });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.items[0].username).toBe('admin');
    expect(result.items[0].exportType).toBe(ExportType.FILE_PREVIEW_STREAM);
  });

  it('should apply export log filters', async () => {
    const qb = mockQueryBuilder([], 0);
    exportLogRepo.createQueryBuilder.mockReturnValue(qb);

    await service.findExportLogs({
      page: 1,
      pageSize: 20,
      userId: 'user-1',
      exportType: ExportType.FILE_ATTACHMENT_STREAM,
      status: OperationResult.SUCCESS,
      startDate: '2025-01-01T00:00:00Z',
      endDate: '2025-12-31T23:59:59Z',
    });

    expect(qb.andWhere).toHaveBeenCalledTimes(5);
  });
});
