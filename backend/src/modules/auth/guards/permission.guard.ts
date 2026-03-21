import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'
import { User } from '../entities/user.entity'

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    )

    if (!requiredPermissions?.length) return true

    const request = context.switchToHttp().getRequest()
    const reqUser = request.user as { id: string } | undefined
    if (!reqUser?.id) throw new ForbiddenException('アクセス権限がありません')

    const user = await this.userRepo.findOne({
      where: { id: reqUser.id },
      relations: ['roles', 'roles.permissions'],
    })
    if (!user) throw new ForbiddenException('アクセス権限がありません')

    const userPermissions = new Set<string>()
    for (const role of user.roles ?? []) {
      for (const perm of role.permissions ?? []) {
        userPermissions.add(perm.permissionCode)
      }
    }

    const hasWildcard = userPermissions.has('*')
    if (hasWildcard) return true

    const hasModuleWildcard = (code: string): boolean => {
      const [mod] = code.split(':')
      return userPermissions.has(`${mod}:*`)
    }

    const granted = requiredPermissions.some(
      (p) => userPermissions.has(p) || hasModuleWildcard(p),
    )

    if (!granted) {
      throw new ForbiddenException('アクセス権限がありません')
    }

    return true
  }
}
