import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { JwtService } from '@nestjs/jwt'
import { UnauthorizedException, BadRequestException } from '@nestjs/common'
import * as bcrypt from 'bcryptjs'
import { AuthService } from './auth.service'
import { User } from './entities/user.entity'
import { LoginLog } from '../log/entities/login-log.entity'
import { UserStatus } from '../../common/constants/enums'

const PASSWORD_HASH = bcrypt.hashSync('correct123', 10)

function createMockUser(overrides: Partial<User> = {}): User {
  return {
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
    roles: [
      {
        id: 'role-1',
        roleName: '業務スタッフ',
        roleCode: 'STAFF',
        description: null,
        isSystem: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        users: [],
        permissions: [
          {
            id: 'perm-1',
            permissionCode: 'customer:list',
            permissionName: '顧客一覧',
            description: null,
            permissionType: 'BUTTON' as any,
            module: 'customer',
            sortOrder: 0,
            createdAt: new Date(),
            roles: [],
          },
        ],
      },
    ],
    ...overrides,
  } as User
}

describe('AuthService', () => {
  let service: AuthService
  let userRepo: Record<string, jest.Mock>
  let loginLogRepo: Record<string, jest.Mock>
  let jwtService: Record<string, jest.Mock>

  beforeEach(async () => {
    userRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((u) => Promise.resolve(u)),
    }

    loginLogRepo = {
      create: jest.fn().mockImplementation((d) => d),
      save: jest.fn().mockResolvedValue(undefined),
    }

    jwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(LoginLog), useValue: loginLogRepo },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile()

    service = module.get<AuthService>(AuthService)
  })

  describe('validateUser', () => {
    it('should return user for valid credentials', async () => {
      const mockUser = createMockUser()
      userRepo.findOne!.mockResolvedValue(mockUser)

      const result = await service.validateUser('testuser', 'correct123')
      expect(result).toBeDefined()
      expect(result!.id).toBe('user-1')
      expect(result!.failedLoginCount).toBe(0)
    })

    it('should return null for non-existent user', async () => {
      userRepo.findOne!.mockResolvedValue(null)

      const result = await service.validateUser('nobody', 'password')
      expect(result).toBeNull()
      expect(loginLogRepo.save).toHaveBeenCalled()
    })

    it('should return null for wrong password', async () => {
      const mockUser = createMockUser()
      userRepo.findOne!.mockResolvedValue(mockUser)

      const result = await service.validateUser('testuser', 'wrongpass')
      expect(result).toBeNull()
      expect(userRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ failedLoginCount: 1 }),
      )
    })

    it('should throw for inactive user', async () => {
      const mockUser = createMockUser({ status: UserStatus.INACTIVE })
      userRepo.findOne!.mockResolvedValue(mockUser)

      await expect(
        service.validateUser('testuser', 'correct123'),
      ).rejects.toThrow(UnauthorizedException)

      await expect(
        service.validateUser('testuser', 'correct123'),
      ).rejects.toThrow('アカウントが無効です')
    })

    it('should throw for locked account', async () => {
      const future = new Date(Date.now() + 10 * 60 * 1000)
      const mockUser = createMockUser({
        failedLoginCount: 5,
        lockedUntil: future,
      })
      userRepo.findOne!.mockResolvedValue(mockUser)

      await expect(
        service.validateUser('testuser', 'correct123'),
      ).rejects.toThrow(UnauthorizedException)

      await expect(
        service.validateUser('testuser', 'correct123'),
      ).rejects.toThrow('アカウントがロックされています')
    })

    it('should increment failed count on wrong password', async () => {
      const mockUser = createMockUser({ failedLoginCount: 2 })
      userRepo.findOne!.mockResolvedValue(mockUser)

      await service.validateUser('testuser', 'wrongpass')

      expect(userRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ failedLoginCount: 3 }),
      )
    })

    it('should lock account after 5 failed attempts', async () => {
      const mockUser = createMockUser({ failedLoginCount: 4 })
      userRepo.findOne!.mockResolvedValue(mockUser)

      await expect(
        service.validateUser('testuser', 'wrongpass'),
      ).rejects.toThrow('ログイン試行回数が上限を超えました')

      expect(userRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          failedLoginCount: 5,
          lockedUntil: expect.any(Date),
        }),
      )
    })

    it('should reset failed count on successful login', async () => {
      const mockUser = createMockUser({ failedLoginCount: 3 })
      userRepo.findOne!.mockResolvedValue(mockUser)

      const result = await service.validateUser('testuser', 'correct123')
      expect(result).toBeDefined()
      expect(userRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ failedLoginCount: 0, lockedUntil: null }),
      )
    })

    it('should allow login after lock expires', async () => {
      const past = new Date(Date.now() - 60 * 1000)
      const mockUser = createMockUser({
        failedLoginCount: 5,
        lockedUntil: past,
      })
      userRepo.findOne!.mockResolvedValue(mockUser)

      const result = await service.validateUser('testuser', 'correct123')
      expect(result).toBeDefined()
      expect(userRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ failedLoginCount: 0, lockedUntil: null }),
      )
    })
  })

  describe('login', () => {
    it('should return access token and user info', async () => {
      const mockUser = createMockUser()
      const result = await service.login(mockUser)

      expect(result.accessToken).toBe('mock-jwt-token')
      expect(result.user.id).toBe('user-1')
      expect(result.user.username).toBe('testuser')
      expect(result.user.roles).toEqual(['STAFF'])
      expect(result.user.permissions).toContain('customer:list')
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 'user-1',
        username: 'testuser',
      })
    })

    it('should record login log', async () => {
      const mockUser = createMockUser()
      await service.login(mockUser, '127.0.0.1', 'TestAgent')

      expect(loginLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          username: 'testuser',
          ipAddress: '127.0.0.1',
          deviceInfo: 'TestAgent',
        }),
      )
      expect(loginLogRepo.save).toHaveBeenCalled()
    })
  })

  describe('getProfile', () => {
    it('should return user info with roles and permissions', async () => {
      const mockUser = createMockUser()
      userRepo.findOne!.mockResolvedValue(mockUser)

      const result = await service.getProfile('user-1')
      expect(result.id).toBe('user-1')
      expect(result.roles).toEqual(['STAFF'])
      expect(result.permissions).toContain('customer:list')
    })

    it('should throw for non-existent user', async () => {
      userRepo.findOne!.mockResolvedValue(null)

      await expect(service.getProfile('nonexistent')).rejects.toThrow(
        UnauthorizedException,
      )
    })
  })

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const mockUser = createMockUser()
      userRepo.findOne!.mockResolvedValue(mockUser)

      await service.changePassword('user-1', 'correct123', 'newpass123')

      expect(userRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          passwordHash: expect.not.stringContaining(PASSWORD_HASH),
        }),
      )
    })

    it('should throw for wrong old password', async () => {
      const mockUser = createMockUser()
      userRepo.findOne!.mockResolvedValue(mockUser)

      await expect(
        service.changePassword('user-1', 'wrongold', 'newpass123'),
      ).rejects.toThrow(BadRequestException)
    })

    it('should throw for non-existent user', async () => {
      userRepo.findOne!.mockResolvedValue(null)

      await expect(
        service.changePassword('nonexistent', 'old', 'new123'),
      ).rejects.toThrow(UnauthorizedException)
    })
  })

  describe('logout', () => {
    it('should record logout log', async () => {
      const mockUser = createMockUser()
      userRepo.findOne!.mockResolvedValue(mockUser)

      await service.logout('user-1')

      expect(loginLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          loginType: 'LOGOUT',
          result: 'SUCCESS',
        }),
      )
    })

    it('should not throw for non-existent user', async () => {
      userRepo.findOne!.mockResolvedValue(null)

      await expect(service.logout('nonexistent')).resolves.toBeUndefined()
    })
  })
})
