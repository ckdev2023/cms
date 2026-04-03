import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';

import {
  LoginType,
  OperationResult,
  UserStatus,
} from '../../common/constants/enums';
import { LoginLog } from '../log/entities/login-log.entity';
import { User } from './entities/user.entity';
import type { JwtPayload } from './interfaces/jwt-payload.interface';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 30 * 60 * 1000;

type AuthUserInfo = {
  id: string;
  username: string;
  displayName: string;
  email: string;
  roles: string[];
  permissions: string[];
  status: UserStatus;
};

type LoginResult = {
  accessToken: string;
  user: AuthUserInfo;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(LoginLog)
    private readonly loginLogRepo: Repository<LoginLog>,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * 校验登录凭证并处理失败次数与账户锁定状态。
   *
   * 用户不存在或密码错误时返回 `null`；账户被锁定或已停用时抛出鉴权异常。
   *
   * @param username - 登录时提交的用户名
   * @param password - 登录时提交的明文密码
   * @returns 验证通过的用户实体；凭证不匹配时返回 `null`
   * @throws {UnauthorizedException} 账户处于锁定中或状态为停用时抛出
   */
  async validateUser(username: string, password: string): Promise<User | null> {
    const user = await this.userRepo.findOne({
      where: { username },
      relations: ['roles', 'roles.permissions'],
    });

    if (!user) {
      await this.recordLoginLog(
        null,
        username,
        LoginType.LOGIN,
        OperationResult.FAILURE,
        'ユーザーが見つかりません',
      );
      return null;
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.recordLoginLog(
        user.id,
        username,
        LoginType.LOGIN,
        OperationResult.FAILURE,
        'アカウントロック中',
      );
      throw new UnauthorizedException(
        'アカウントがロックされています。30分後にお試しください。',
      );
    }

    if (user.lockedUntil && user.lockedUntil <= new Date()) {
      user.failedLoginCount = 0;
      user.lockedUntil = null;
      await this.userRepo.save(user);
    }

    if (user.status === UserStatus.INACTIVE) {
      await this.recordLoginLog(
        user.id,
        username,
        LoginType.LOGIN,
        OperationResult.FAILURE,
        'アカウント無効',
      );
      throw new UnauthorizedException(
        'アカウントが無効です。管理者にお問い合わせください。',
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      user.failedLoginCount = (user.failedLoginCount || 0) + 1;

      if (user.failedLoginCount >= MAX_FAILED_ATTEMPTS) {
        user.lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
        await this.userRepo.save(user);
        await this.recordLoginLog(
          user.id,
          username,
          LoginType.LOGIN,
          OperationResult.FAILURE,
          `${MAX_FAILED_ATTEMPTS}回失敗でロック`,
        );
        throw new UnauthorizedException(
          'ログイン試行回数が上限を超えました。30分後にお試しください。',
        );
      }

      await this.userRepo.save(user);
      await this.recordLoginLog(
        user.id,
        username,
        LoginType.LOGIN,
        OperationResult.FAILURE,
        'パスワード不一致',
      );
      return null;
    }

    if (user.failedLoginCount > 0) {
      user.failedLoginCount = 0;
      user.lockedUntil = null;
      await this.userRepo.save(user);
    }

    return user;
  }

  /**
   * 为已通过鉴权的用户签发访问令牌并记录登录日志。
   *
   * @param user - 已完成身份校验且带有角色权限关系的用户实体
   * @param ipAddress - 发起登录请求的 IP 地址，缺省时记录为 `null`
   * @param deviceInfo - 发起登录请求的设备信息，缺省时记录为 `null`
   * @returns 包含 JWT 访问令牌与前端所需用户信息的登录结果
   */
  async login(
    user: User,
    ipAddress?: string,
    deviceInfo?: string,
  ): Promise<LoginResult> {
    const payload: JwtPayload = { sub: user.id, username: user.username };
    const accessToken = this.jwtService.sign(payload);
    const userInfo = this.buildUserInfo(user);

    await this.recordLoginLog(
      user.id,
      user.username,
      LoginType.LOGIN,
      OperationResult.SUCCESS,
      null,
      ipAddress,
      deviceInfo,
    );
    this.logger.log(`User "${user.username}" logged in`);

    return { accessToken, user: userInfo };
  }

  /**
   * 根据用户 ID 记录退出登录行为。
   *
   * 用户不存在时静默返回，避免退出接口因历史令牌失效而额外报错。
   *
   * @param userId - 当前退出用户的主键 ID
   */
  async logout(userId: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (user) {
      await this.recordLoginLog(
        user.id,
        user.username,
        LoginType.LOGOUT,
        OperationResult.SUCCESS,
      );
      this.logger.log(`User "${user.username}" logged out`);
    }
  }

  /**
   * 查询当前登录用户的基础资料、角色与权限集合。
   *
   * @param userId - 需要查询资料的用户 ID
   * @returns 供前端展示与鉴权使用的用户信息对象
   * @throws {UnauthorizedException} 用户不存在时抛出
   */
  async getProfile(userId: string): Promise<AuthUserInfo> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['roles', 'roles.permissions'],
    });

    if (!user) {
      throw new UnauthorizedException('ユーザーが見つかりません');
    }

    return this.buildUserInfo(user);
  }

  /**
   * 校验旧密码后为指定用户更新新的密码哈希。
   *
   * @param userId - 需要修改密码的用户 ID
   * @param oldPassword - 用户输入的当前明文密码
   * @param newPassword - 用户输入的新明文密码
   * @throws {UnauthorizedException} 用户不存在时抛出
   * @throws {BadRequestException} 当前密码校验失败时抛出
   */
  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });

    if (!user) {
      throw new UnauthorizedException('ユーザーが見つかりません');
    }

    const isOldPasswordValid = await bcrypt.compare(
      oldPassword,
      user.passwordHash,
    );
    if (!isOldPasswordValid) {
      throw new BadRequestException('現在のパスワードが正しくありません');
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await this.userRepo.save(user);
    this.logger.log(`User "${user.username}" changed password`);
  }

  /**
   * 从用户实体中整理前端消费所需的角色与权限信息。
   *
   * @param user - 已加载角色与权限关系的用户实体
   * @returns 去重后的用户资料对象
   */
  private buildUserInfo(user: User): AuthUserInfo {
    const roles = user.roles?.map((role) => role.roleCode) ?? [];
    const permissionSet = new Set<string>();

    for (const role of user.roles ?? []) {
      for (const permission of role.permissions ?? []) {
        permissionSet.add(permission.permissionCode);
      }
    }

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email ?? '',
      roles,
      permissions: [...permissionSet],
      status: user.status,
    };
  }

  /**
   * 持久化登录或退出日志，并在日志写入失败时降级为告警。
   *
   * @param userId - 关联用户 ID；匿名失败场景可为空
   * @param username - 本次操作对应的用户名
   * @param loginType - 登录或退出的行为类型
   * @param result - 本次行为的执行结果
   * @param failureReason - 登录失败原因，成功场景可为空
   * @param ipAddress - 请求来源 IP，缺省时写入 `null`
   * @param deviceInfo - 请求设备信息，缺省时写入 `null`
   */
  private async recordLoginLog(
    userId: string | null,
    username: string,
    loginType: LoginType,
    result: OperationResult,
    failureReason?: string | null,
    ipAddress?: string | null,
    deviceInfo?: string | null,
  ): Promise<void> {
    try {
      const log = this.loginLogRepo.create({
        userId,
        username,
        loginType,
        result,
        failureReason: failureReason ?? null,
        ipAddress: ipAddress ?? null,
        deviceInfo: deviceInfo ?? null,
      });
      await this.loginLogRepo.save(log);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to record login log: ${reason}`);
    }
  }
}
