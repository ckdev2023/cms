import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';

import {
  LoginType,
  OperationResult,
  PermissionType,
  UserStatus,
} from '../../common/constants/enums';
import { LoginLog } from '../log/entities/login-log.entity';
import { AuthService } from './auth.service';
import { Permission } from './entities/permission.entity';
import { Role } from './entities/role.entity';
import { User } from './entities/user.entity';
import type { JwtPayload } from './interfaces/jwt-payload.interface';

const PASSWORD_HASH = bcrypt.hashSync('correct123', 10);

type UserRepoMock = {
  findOne: jest.Mock<Promise<User | null>, [unknown]>;
  save: jest.Mock<Promise<User>, [User]>;
};

type LoginLogInput = Pick<
  LoginLog,
  | 'userId'
  | 'username'
  | 'loginType'
  | 'result'
  | 'failureReason'
  | 'ipAddress'
  | 'deviceInfo'
>;

type LoginLogRepoMock = {
  create: jest.Mock<LoginLogInput, [LoginLogInput]>;
  save: jest.Mock<Promise<void>, [LoginLogInput]>;
};

type JwtServiceMock = {
  sign: jest.Mock<string, [JwtPayload]>;
};

let service: AuthService;
let userRepo: UserRepoMock;
let loginLogRepo: LoginLogRepoMock;
let jwtService: JwtServiceMock;

function createMockPermission(overrides: Partial<Permission> = {}): Permission {
  return Object.assign(new Permission(), {
    id: 'perm-1',
    permissionCode: 'customer:list',
    permissionName: '顧客一覧',
    description: null,
    permissionType: PermissionType.BUTTON,
    module: 'customer',
    sortOrder: 0,
    createdAt: new Date(),
    roles: [],
    ...overrides,
  });
}

function createMockRole(overrides: Partial<Role> = {}): Role {
  return Object.assign(new Role(), {
    id: 'role-1',
    roleName: '業務スタッフ',
    roleCode: 'STAFF',
    description: null,
    isSystem: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    users: [],
    permissions: [createMockPermission()],
    ...overrides,
  });
}

function createMockUser(overrides: Partial<User> = {}): User {
  return Object.assign(new User(), {
    id: 'user-1',
    username: 'testuser',
    passwordHash: PASSWORD_HASH,
    displayName: 'テストユーザー',
    email: 'test@example.com',
    phone: null,
    status: UserStatus.ACTIVE,
    failedLoginCount: 0,
    lockedUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    roles: [createMockRole()],
    ...overrides,
  });
}

async function createAuthTestingModule(): Promise<TestingModule> {
  userRepo = {
    findOne: jest.fn<Promise<User | null>, [unknown]>(),
    save: jest
      .fn<Promise<User>, [User]>()
      .mockImplementation((user: User) => Promise.resolve(user)),
  };

  loginLogRepo = {
    create: jest
      .fn<LoginLogInput, [LoginLogInput]>()
      .mockImplementation((data: LoginLogInput) => data),
    save: jest
      .fn<Promise<void>, [LoginLogInput]>()
      .mockResolvedValue(undefined),
  };

  jwtService = {
    sign: jest.fn<string, [JwtPayload]>().mockReturnValue('mock-jwt-token'),
  };

  return Test.createTestingModule({
    providers: [
      AuthService,
      { provide: getRepositoryToken(User), useValue: userRepo },
      { provide: getRepositoryToken(LoginLog), useValue: loginLogRepo },
      { provide: JwtService, useValue: jwtService },
    ],
  }).compile();
}

function defineValidateUserHappyPathTests(): void {
  it('returns user for valid credentials', async () => {
    const mockUser = createMockUser();
    userRepo.findOne.mockResolvedValue(mockUser);

    const result = await service.validateUser('testuser', 'correct123');

    expect(result).toBeDefined();
    expect(result?.id).toBe('user-1');
    expect(result?.failedLoginCount).toBe(0);
  });

  it('returns null for non-existent user', async () => {
    userRepo.findOne.mockResolvedValue(null);

    const result = await service.validateUser('nobody', 'password');

    expect(result).toBeNull();
    expect(loginLogRepo.save).toHaveBeenCalled();
  });

  it('returns null and increments failed count for wrong password', async () => {
    const mockUser = createMockUser();
    userRepo.findOne.mockResolvedValue(mockUser);

    const result = await service.validateUser('testuser', 'wrongpass');
    const savedUser = userRepo.save.mock.calls[0]?.[0];

    expect(result).toBeNull();
    expect(savedUser?.failedLoginCount).toBe(1);
  });
}

function defineValidateUserLockTests(): void {
  it('throws for inactive user', async () => {
    const mockUser = createMockUser({ status: UserStatus.INACTIVE });
    userRepo.findOne.mockResolvedValue(mockUser);

    await expect(
      service.validateUser('testuser', 'correct123'),
    ).rejects.toThrow(UnauthorizedException);
    await expect(
      service.validateUser('testuser', 'correct123'),
    ).rejects.toThrow('アカウントが無効です');
  });

  it('throws for locked account', async () => {
    const future = new Date(Date.now() + 10 * 60 * 1000);
    const mockUser = createMockUser({
      failedLoginCount: 5,
      lockedUntil: future,
    });
    userRepo.findOne.mockResolvedValue(mockUser);

    await expect(
      service.validateUser('testuser', 'correct123'),
    ).rejects.toThrow(UnauthorizedException);
    await expect(
      service.validateUser('testuser', 'correct123'),
    ).rejects.toThrow('アカウントがロックされています');
  });

  it('locks account after 5 failed attempts', async () => {
    const mockUser = createMockUser({ failedLoginCount: 4 });
    userRepo.findOne.mockResolvedValue(mockUser);

    await expect(service.validateUser('testuser', 'wrongpass')).rejects.toThrow(
      'ログイン試行回数が上限を超えました',
    );

    const savedUser = userRepo.save.mock.calls[0]?.[0];
    expect(savedUser?.failedLoginCount).toBe(5);
    expect(savedUser?.lockedUntil).toBeInstanceOf(Date);
  });
}

function defineValidateUserResetTests(): void {
  it('increments failed count from an existing value', async () => {
    const mockUser = createMockUser({ failedLoginCount: 2 });
    userRepo.findOne.mockResolvedValue(mockUser);

    await service.validateUser('testuser', 'wrongpass');

    const savedUser = userRepo.save.mock.calls[0]?.[0];
    expect(savedUser?.failedLoginCount).toBe(3);
  });

  it('resets failed count on successful login', async () => {
    const mockUser = createMockUser({ failedLoginCount: 3 });
    userRepo.findOne.mockResolvedValue(mockUser);

    const result = await service.validateUser('testuser', 'correct123');
    const savedUser = userRepo.save.mock.calls[0]?.[0];

    expect(result).toBeDefined();
    expect(savedUser?.failedLoginCount).toBe(0);
    expect(savedUser?.lockedUntil).toBeNull();
  });

  it('allows login after lock expires', async () => {
    const past = new Date(Date.now() - 60 * 1000);
    const mockUser = createMockUser({
      failedLoginCount: 5,
      lockedUntil: past,
    });
    userRepo.findOne.mockResolvedValue(mockUser);

    const result = await service.validateUser('testuser', 'correct123');
    const savedUser = userRepo.save.mock.calls[0]?.[0];

    expect(result).toBeDefined();
    expect(savedUser?.failedLoginCount).toBe(0);
    expect(savedUser?.lockedUntil).toBeNull();
  });
}

function defineValidateUserTests(): void {
  describe('validateUser', () => {
    defineValidateUserHappyPathTests();
    defineValidateUserLockTests();
    defineValidateUserResetTests();
  });
}

function defineLoginTests(): void {
  describe('login', () => {
    it('returns access token and user info', async () => {
      const mockUser = createMockUser();
      const result = await service.login(mockUser);

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.user.id).toBe('user-1');
      expect(result.user.username).toBe('testuser');
      expect(result.user.roles).toEqual(['STAFF']);
      expect(result.user.permissions).toContain('customer:list');
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 'user-1',
        username: 'testuser',
      });
    });

    it('records login log with request metadata', async () => {
      const mockUser = createMockUser();
      await service.login(mockUser, '127.0.0.1', 'TestAgent');

      const logInput = loginLogRepo.create.mock.calls[0]?.[0];
      expect(logInput?.userId).toBe('user-1');
      expect(logInput?.username).toBe('testuser');
      expect(logInput?.ipAddress).toBe('127.0.0.1');
      expect(logInput?.deviceInfo).toBe('TestAgent');
      expect(loginLogRepo.save).toHaveBeenCalled();
    });
  });
}

function defineProfileTests(): void {
  describe('getProfile', () => {
    it('returns user info with roles and permissions', async () => {
      const mockUser = createMockUser();
      userRepo.findOne.mockResolvedValue(mockUser);

      const result = await service.getProfile('user-1');

      expect(result.id).toBe('user-1');
      expect(result.roles).toEqual(['STAFF']);
      expect(result.permissions).toContain('customer:list');
    });

    it('throws for non-existent user', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.getProfile('nonexistent')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
}

function defineChangePasswordTests(): void {
  describe('changePassword', () => {
    it('changes password successfully', async () => {
      const mockUser = createMockUser();
      userRepo.findOne.mockResolvedValue(mockUser);

      await service.changePassword('user-1', 'correct123', 'newpass123');

      const savedUser = userRepo.save.mock.calls[0]?.[0];
      expect(savedUser).toBeDefined();
      expect(savedUser?.passwordHash).not.toBe(PASSWORD_HASH);
      await expect(
        bcrypt.compare('newpass123', savedUser?.passwordHash ?? ''),
      ).resolves.toBe(true);
    });

    it('throws for wrong old password', async () => {
      const mockUser = createMockUser();
      userRepo.findOne.mockResolvedValue(mockUser);

      await expect(
        service.changePassword('user-1', 'wrongold', 'newpass123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws for non-existent user', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.changePassword('nonexistent', 'old', 'new123'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
}

function defineLogoutTests(): void {
  describe('logout', () => {
    it('records logout log', async () => {
      const mockUser = createMockUser();
      userRepo.findOne.mockResolvedValue(mockUser);

      await service.logout('user-1');

      const logInput = loginLogRepo.create.mock.calls[0]?.[0];
      expect(logInput?.userId).toBe('user-1');
      expect(logInput?.loginType).toBe(LoginType.LOGOUT);
      expect(logInput?.result).toBe(OperationResult.SUCCESS);
    });

    it('does not throw for non-existent user', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.logout('nonexistent')).resolves.toBeUndefined();
    });
  });
}

describe('AuthService', () => {
  beforeEach(async () => {
    const testingModule = await createAuthTestingModule();
    service = testingModule.get<AuthService>(AuthService);
  });

  defineValidateUserTests();
  defineLoginTests();
  defineProfileTests();
  defineChangePasswordTests();
  defineLogoutTests();
});
