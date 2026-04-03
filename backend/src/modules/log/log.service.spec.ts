import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import {
  AuditActionType,
  AuditTargetType,
  LoginType,
  OperationResult,
} from '../../common/constants/enums';
import { AuditLog } from './entities/audit-log.entity';
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

function mockQueryBuilder(items: unknown[] = [], total = 0): MockQueryBuilder {
  const qb: MockQueryBuilder = {
    leftJoin: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([items, total]),
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

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      LogService,
      { provide: getRepositoryToken(AuditLog), useValue: auditLogRepo },
      { provide: getRepositoryToken(LoginLog), useValue: loginLogRepo },
    ],
  }).compile();

  return {
    service: module.get<LogService>(LogService),
    auditLogRepo,
    loginLogRepo,
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
