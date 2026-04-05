import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { VisaDataScope } from '../../../common/constants/enums';
import { VisaCaseDataScopePermissionService } from '../visa-case-data-scope-permission.service';

const ACCESS_DENIED_MESSAGE = 'アクセス権限がありません';

type RequestWithUser = {
  user?: { id?: string };
  query: Record<string, unknown>;
};

/**
 * 在已通过 JWT 与 `@Permissions` 后，校验 Query 中 `dataScope` 不超过用户签证数据范围授权（P2-S2d）。
 */
@Injectable()
export class VisaCaseDataScopeQueryGuard implements CanActivate {
  constructor(
    private readonly visaCaseDataScopePermission: VisaCaseDataScopePermissionService,
  ) {}

  /**
   * 读取 `dataScope` 查询参数并与当前用户权限比对，越权时拒绝请求。
   *
   * @param context - Nest 执行上下文
   * @returns 允许继续管道与处理器时返回 true
   * @throws {ForbiddenException} 缺少用户或权限加载失败时
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const userId = request.user?.id;
    if (!userId) {
      throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
    }

    const raw = request.query?.dataScope;
    const parsed = this.parseDataScopeQuery(raw);
    if (parsed === 'invalid') {
      return true;
    }

    const permissions =
      await this.visaCaseDataScopePermission.loadPermissionCodesForUser(userId);

    this.visaCaseDataScopePermission.assertQueryDataScopeAllowed(
      permissions,
      parsed,
    );
    return true;
  }

  /**
   * 将原始 query 值解析为枚举或缺省；无法识别时返回 invalid 以交给 ValidationPipe 返回 400。
   *
   * @param raw - 原始查询参数
   * @returns 枚举值、undefined（缺省 all）或 invalid
   */
  private parseDataScopeQuery(
    raw: unknown,
  ): VisaDataScope | undefined | 'invalid' {
    if (raw === undefined || raw === null || raw === '') {
      return undefined;
    }
    if (Array.isArray(raw)) {
      return this.parseDataScopeQuery(raw[0]);
    }
    if (typeof raw !== 'string') {
      return 'invalid';
    }
    const lower = raw.trim().toLowerCase();
    const allowed = new Set<string>(Object.values(VisaDataScope));
    if (!allowed.has(lower)) {
      return 'invalid';
    }
    return lower as VisaDataScope;
  }
}
