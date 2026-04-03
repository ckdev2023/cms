import { SetMetadata } from '@nestjs/common';

/**
 * 标记路由允许匿名访问的元数据键。
 *
 * 认证守卫会据此跳过 JWT 校验，供登录、健康检查等公开接口复用。
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * 将控制器或路由标记为公开接口。
 *
 * @returns 写入公开访问标记的 Nest 装饰器。
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
