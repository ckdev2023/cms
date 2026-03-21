import { Injectable, UnauthorizedException } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {
  handleRequest<T>(err: Error | null, user: T): T {
    if (err || !user) {
      throw (
        err ||
        new UnauthorizedException(
          'ユーザー名またはパスワードが正しくありません',
        )
      )
    }
    return user
  }
}
