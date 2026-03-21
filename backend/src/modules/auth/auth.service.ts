import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import * as bcrypt from 'bcryptjs'
import { User } from './entities/user.entity'
import { LoginLog } from '../log/entities/login-log.entity'
import { UserStatus, LoginType, OperationResult } from '../../common/constants/enums'
import type { JwtPayload } from './interfaces/jwt-payload.interface'

const MAX_FAILED_ATTEMPTS = 5
const LOCK_DURATION_MS = 30 * 60 * 1000

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(LoginLog)
    private readonly loginLogRepo: Repository<LoginLog>,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(username: string, password: string): Promise<User | null> {
    const user = await this.userRepo.findOne({
      where: { username },
      relations: ['roles', 'roles.permissions'],
    })

    if (!user) {
      await this.recordLoginLog(null, username, LoginType.LOGIN, OperationResult.FAILURE, 'ユーザーが見つかりません')
      return null
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.recordLoginLog(user.id, username, LoginType.LOGIN, OperationResult.FAILURE, 'アカウントロック中')
      throw new UnauthorizedException('アカウントがロックされています。30分後にお試しください。')
    }

    if (user.lockedUntil && user.lockedUntil <= new Date()) {
      user.failedLoginCount = 0
      user.lockedUntil = null
      await this.userRepo.save(user)
    }

    if (user.status === UserStatus.INACTIVE) {
      await this.recordLoginLog(user.id, username, LoginType.LOGIN, OperationResult.FAILURE, 'アカウント無効')
      throw new UnauthorizedException('アカウントが無効です。管理者にお問い合わせください。')
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      user.failedLoginCount = (user.failedLoginCount || 0) + 1

      if (user.failedLoginCount >= MAX_FAILED_ATTEMPTS) {
        user.lockedUntil = new Date(Date.now() + LOCK_DURATION_MS)
        await this.userRepo.save(user)
        await this.recordLoginLog(user.id, username, LoginType.LOGIN, OperationResult.FAILURE, `${MAX_FAILED_ATTEMPTS}回失敗でロック`)
        throw new UnauthorizedException('ログイン試行回数が上限を超えました。30分後にお試しください。')
      }

      await this.userRepo.save(user)
      await this.recordLoginLog(user.id, username, LoginType.LOGIN, OperationResult.FAILURE, 'パスワード不一致')
      return null
    }

    if (user.failedLoginCount > 0) {
      user.failedLoginCount = 0
      user.lockedUntil = null
      await this.userRepo.save(user)
    }

    return user
  }

  async login(user: User, ipAddress?: string, deviceInfo?: string) {
    const payload: JwtPayload = { sub: user.id, username: user.username }
    const accessToken = this.jwtService.sign(payload)
    const userInfo = this.buildUserInfo(user)

    await this.recordLoginLog(user.id, user.username, LoginType.LOGIN, OperationResult.SUCCESS, null, ipAddress, deviceInfo)
    this.logger.log(`User "${user.username}" logged in`)

    return { accessToken, user: userInfo }
  }

  async logout(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } })
    if (user) {
      await this.recordLoginLog(user.id, user.username, LoginType.LOGOUT, OperationResult.SUCCESS)
      this.logger.log(`User "${user.username}" logged out`)
    }
  }

  async getProfile(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['roles', 'roles.permissions'],
    })

    if (!user) {
      throw new UnauthorizedException('ユーザーが見つかりません')
    }

    return this.buildUserInfo(user)
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } })

    if (!user) {
      throw new UnauthorizedException('ユーザーが見つかりません')
    }

    const isOldValid = await bcrypt.compare(oldPassword, user.passwordHash)
    if (!isOldValid) {
      throw new BadRequestException('現在のパスワードが正しくありません')
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10)
    await this.userRepo.save(user)
    this.logger.log(`User "${user.username}" changed password`)
  }

  private buildUserInfo(user: User) {
    const roles = user.roles?.map((r) => r.roleCode) ?? []
    const permSet = new Set<string>()
    for (const role of user.roles ?? []) {
      for (const perm of role.permissions ?? []) {
        permSet.add(perm.permissionCode)
      }
    }

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email ?? '',
      roles,
      permissions: [...permSet],
      status: user.status,
    }
  }

  private async recordLoginLog(
    userId: string | null,
    username: string,
    loginType: LoginType,
    result: OperationResult,
    failureReason?: string | null,
    ipAddress?: string | null,
    deviceInfo?: string | null,
  ) {
    try {
      const log = this.loginLogRepo.create({
        userId,
        username,
        loginType,
        result,
        failureReason: failureReason ?? null,
        ipAddress: ipAddress ?? null,
        deviceInfo: deviceInfo ?? null,
      })
      await this.loginLogRepo.save(log)
    } catch (err) {
      this.logger.warn(`Failed to record login log: ${err}`)
    }
  }
}
