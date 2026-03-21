import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger'
import type { Request } from 'express'
import { AuthService } from './auth.service'
import { LoginDto, ChangePasswordDto } from './dto'
import { LocalAuthGuard } from './guards/local-auth.guard'
import { Public } from './decorators'
import type { User } from './entities/user.entity'

@ApiTags('認証')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @UseGuards(LocalAuthGuard)
  @ApiOperation({ summary: 'ログイン' })
  @ApiBody({ type: LoginDto })
  async login(@Req() req: Request) {
    const user = req.user as User
    const ip = req.ip || req.socket?.remoteAddress
    const ua = req.headers['user-agent']
    return this.authService.login(user, ip, ua)
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ログアウト' })
  async logout(@Req() req: Request) {
    const { id } = req.user as { id: string }
    await this.authService.logout(id)
    return null
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: '現在のユーザー情報取得' })
  async getProfile(@Req() req: Request) {
    const { id } = req.user as { id: string }
    return this.authService.getProfile(id)
  }

  @Put('change-password')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'パスワード変更' })
  async changePassword(
    @Req() req: Request,
    @Body() dto: ChangePasswordDto,
  ) {
    const { id } = req.user as { id: string }
    await this.authService.changePassword(id, dto.oldPassword, dto.newPassword)
    return null
  }
}
