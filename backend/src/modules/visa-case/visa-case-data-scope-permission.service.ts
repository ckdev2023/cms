import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { VisaDataScope } from '../../common/constants/enums';
import { PermissionCodes } from '../../common/constants/permission-codes';
import { User } from '../auth/entities/user.entity';
import { VisaCaseDataScopeService } from './visa-case-data-scope.service';
import { isVisaCaseAssignedRowInResolvedScope } from './visa-case-data-scope-visibility.util';

const ACCESS_DENIED_MESSAGE = 'アクセス権限がありません';
const VISA_CASE_NOT_FOUND_MESSAGE = 'ビザ案件が見つかりません';

/**
 * 将 RBAC 权限码与 `dataScope` 查询参数组合校验（P2-S2d / docs/21 §18.6），供 Guard 与案件行级双校验复用。
 */
@Injectable()
export class VisaCaseDataScopePermissionService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly visaCaseDataScope: VisaCaseDataScopeService,
  ) {}

  /**
   * 展开当前用户角色绑定的全部权限码，供范围上限与 Guard 判定使用。
   *
   * @param userId - 当前登录用户主键
   * @returns 去重后的权限码集合；用户不存在时返回空集
   */
  async loadPermissionCodesForUser(userId: string): Promise<Set<string>> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['roles', 'roles.permissions'],
    });
    const codes = new Set<string>();
    if (!user) {
      return codes;
    }
    for (const role of user.roles ?? []) {
      for (const perm of role.permissions ?? []) {
        codes.add(perm.permissionCode);
      }
    }
    return codes;
  }

  /**
   * 根据权限码计算用户在签证域可读写的最大数据范围（未配置 dataScope 类权限时与历史行为一致视为 `all`）。
   *
   * @param permissions - 当前用户权限码集合
   * @returns 允许请求的最宽 `VisaDataScope` 枚举值
   */
  getMaxAllowedVisaDataScope(permissions: Set<string>): VisaDataScope {
    if (permissions.has('*')) {
      return VisaDataScope.ALL;
    }
    if (this.hasModuleWildcard('visaCase', permissions)) {
      return VisaDataScope.ALL;
    }
    const hasExplicit =
      permissions.has(PermissionCodes.VISA_CASE_DATA_SCOPE_ALL) ||
      permissions.has(PermissionCodes.VISA_CASE_DATA_SCOPE_TEAM) ||
      permissions.has(PermissionCodes.VISA_CASE_DATA_SCOPE_MINE);
    if (!hasExplicit) {
      return VisaDataScope.ALL;
    }
    if (permissions.has(PermissionCodes.VISA_CASE_DATA_SCOPE_ALL)) {
      return VisaDataScope.ALL;
    }
    if (permissions.has(PermissionCodes.VISA_CASE_DATA_SCOPE_TEAM)) {
      return VisaDataScope.TEAM;
    }
    return VisaDataScope.MINE;
  }

  /**
   * 校验 Query 中声明的 `dataScope` 不超出当前用户被授权的最大范围；越权时抛出 403。
   *
   * @param permissions - 当前用户权限码集合
   * @param requested - 请求可选范围；缺省按 `all`
   * @throws {ForbiddenException} 请求的收窄档位宽于授权上限时
   */
  assertQueryDataScopeAllowed(
    permissions: Set<string>,
    requested?: VisaDataScope,
  ): void {
    const max = this.getMaxAllowedVisaDataScope(permissions);
    const req = requested ?? VisaDataScope.ALL;
    if (
      this.compareVisaDataScopeWideness(req) >
      this.compareVisaDataScopeWideness(max)
    ) {
      throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
    }
  }

  /**
   * 在已通过写能力校验的前提下，按用户最大授权范围判断目标案件行是否可访问（读用 404、写用 403）。
   *
   * @param userId - 当前登录用户主键
   * @param assignedTo - 目标案件 `assigned_to` 字段
   * @param mode - `read` 时越权抛 NotFound；`write` 时越权抛 Forbidden
   * @throws {NotFoundException} 模式为读且案件不在范围内时（与不存在统一文案）
   * @throws {ForbiddenException} 模式为写且案件不在范围内时
   */
  async assertVisaCaseRowAccessible(
    userId: string,
    assignedTo: string | null,
    mode: 'read' | 'write',
  ): Promise<void> {
    const permissions = await this.loadPermissionCodesForUser(userId);
    const max = this.getMaxAllowedVisaDataScope(permissions);
    const resolved = await this.visaCaseDataScope.resolve(userId, max);
    if (isVisaCaseAssignedRowInResolvedScope(assignedTo, resolved)) {
      return;
    }
    if (mode === 'read') {
      throw new NotFoundException(VISA_CASE_NOT_FOUND_MESSAGE);
    }
    throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
  }

  /**
   * 将三档范围映射为可比较的宽度序号，`all` 最宽。
   *
   * @param scope - 数据范围枚举
   * @returns 越大表示可见行集越宽
   */
  private compareVisaDataScopeWideness(scope: VisaDataScope): number {
    switch (scope) {
      case VisaDataScope.MINE:
        return 0;
      case VisaDataScope.TEAM:
        return 1;
      case VisaDataScope.ALL:
        return 2;
      default:
        return 0;
    }
  }

  /**
   * 判断是否存在与某模块前缀匹配的 `module:*` 通配权限。
   *
   * @param moduleCode - 模块段，如 `visaCase`
   * @param permissions - 用户权限集合
   * @returns 存在通配时返回 true
   */
  private hasModuleWildcard(
    moduleCode: string,
    permissions: Set<string>,
  ): boolean {
    return permissions.has(`${moduleCode}:*`);
  }
}
