import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { User } from '../entities/user.entity';

const ACCESS_DENIED_MESSAGE = 'アクセス権限がありません';

type AuthenticatedRequest = {
  user?: {
    id?: string;
  };
};

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /**
   * 根据路由声明的权限码校验当前登录用户是否允许访问。
   *
   * 支持 `@Public()` 公开路由、全局通配符 `*`、模块通配符 `module:*` 和精确权限码四种放行路径。
   *
   * @param context - NestJS 执行上下文，用于读取路由元数据和当前请求用户
   * @returns 当前请求满足权限要求时返回 true
   * @throws {ForbiddenException} 请求缺少用户标识、用户不存在或权限不足时
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.isPublicRoute(context)) {
      return true;
    }

    const requiredPermissions = this.getRequiredPermissions(context);
    if (requiredPermissions.length === 0) {
      return true;
    }

    const userId = this.getRequestUserId(context);
    const user = await this.loadUserWithPermissions(userId);
    const userPermissions = this.collectPermissionCodes(user);

    if (!this.hasRequiredPermission(requiredPermissions, userPermissions)) {
      throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
    }

    return true;
  }

  /**
   * 读取路由上的公开访问标记，决定是否跳过权限校验。
   *
   * @param context - 当前请求的执行上下文
   * @returns 路由声明了 `@Public()` 时返回 true
   */
  private isPublicRoute(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false
    );
  }

  /**
   * 汇总控制器和处理器上声明的权限码列表。
   *
   * @param context - 当前请求的执行上下文
   * @returns 需要命中的权限码数组；未声明时返回空数组
   */
  private getRequiredPermissions(context: ExecutionContext): string[] {
    return (
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? []
    );
  }

  /**
   * 从当前 HTTP 请求中提取已认证用户的主键标识。
   *
   * @param context - 当前请求的执行上下文
   * @returns 当前登录用户的 ID
   * @throws {ForbiddenException} 请求上下文中缺少用户标识时
   */
  private getRequestUserId(context: ExecutionContext): string {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user?.id;

    if (!userId) {
      throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
    }

    return userId;
  }

  /**
   * 按权限校验所需关联一次性加载用户角色与权限集合。
   *
   * @param userId - 当前登录用户的主键 ID
   * @returns 已加载角色及权限关联的用户实体
   * @throws {ForbiddenException} 数据库中找不到对应用户时
   */
  private async loadUserWithPermissions(userId: string): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['roles', 'roles.permissions'],
    });

    if (!user) {
      throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
    }

    return user;
  }

  /**
   * 将用户绑定的角色权限展开为便于命中的权限码集合。
   *
   * @param user - 已加载 `roles.permissions` 关联的用户实体
   * @returns 去重后的权限码集合
   */
  private collectPermissionCodes(user: User): Set<string> {
    const permissions = new Set<string>();

    for (const role of user.roles ?? []) {
      for (const perm of role.permissions ?? []) {
        permissions.add(perm.permissionCode);
      }
    }

    return permissions;
  }

  /**
   * 按全局通配符、模块通配符和精确权限码三层规则判定是否放行。
   *
   * @param requiredPermissions - 路由要求具备的权限码列表
   * @param userPermissions - 当前用户展开后的权限码集合
   * @returns 任意一个权限码匹配成功时返回 true
   */
  private hasRequiredPermission(
    requiredPermissions: string[],
    userPermissions: Set<string>,
  ): boolean {
    if (userPermissions.has('*')) {
      return true;
    }

    return requiredPermissions.some(
      (permissionCode) =>
        userPermissions.has(permissionCode) ||
        this.hasModuleWildcard(permissionCode, userPermissions),
    );
  }

  /**
   * 判断权限集合中是否存在与目标权限同模块的通配授权。
   *
   * @param permissionCode - 当前待校验的精确权限码
   * @param userPermissions - 当前用户展开后的权限码集合
   * @returns 存在 `module:*` 形式的模块通配授权时返回 true
   */
  private hasModuleWildcard(
    permissionCode: string,
    userPermissions: Set<string>,
  ): boolean {
    const [moduleCode] = permissionCode.split(':');

    return userPermissions.has(`${moduleCode}:*`);
  }
}
