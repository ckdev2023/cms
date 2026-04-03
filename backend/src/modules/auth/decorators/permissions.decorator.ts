import { SetMetadata } from '@nestjs/common';

import type { PermissionCode } from '../../../common/constants/permission-codes';

/**
 * 标记路由所需的权限码元数据键。
 *
 * Guards 会读取该元数据并与当前登录用户的权限集合进行匹配。
 */
export const PERMISSIONS_KEY = 'permissions';

/**
 * 为控制器或路由声明访问所需的权限码集合。
 *
 * 当前实现按“命中任一权限即可通过”进行鉴权，适合读写权限拆分的业务场景。
 *
 * @param permissions 允许访问当前处理器的权限码列表。
 * @returns 写入权限元数据的 Nest 装饰器。
 * @example `@Permissions('customer:create')`
 * @example `@Permissions('finance:edit', 'finance:create')`
 */
export const Permissions = (...permissions: PermissionCode[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
