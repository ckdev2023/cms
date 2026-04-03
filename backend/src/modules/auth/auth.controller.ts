import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { AuthService } from './auth.service';
import { Public } from './decorators';
import { ChangePasswordDto, LoginDto } from './dto';
import type { User } from './entities/user.entity';
import { LocalAuthGuard } from './guards/local-auth.guard';

type LoginRequest = Request & { user: User };
type AuthenticatedRequest = Request & { user: Pick<User, 'id'> };

@ApiTags('認証')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * 基于本地鉴权结果签发访问令牌并记录登录日志。
   *
   * @param req - 已由 `LocalAuthGuard` 注入认证用户的请求对象
   * @returns 包含访问令牌和当前用户概要信息的登录结果
   */
  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @UseGuards(LocalAuthGuard)
  @ApiOperation({ summary: 'ログイン' })
  @ApiBody({ type: LoginDto })
  async login(@Req() req: LoginRequest) {
    const ip = req.ip || req.socket?.remoteAddress;
    const ua = req.headers['user-agent'];
    return this.authService.login(req.user, ip, ua);
  }

  /**
   * 终止当前登录会话并补记登出日志。
   *
   * @param req - 携带当前登录用户标识的认证请求对象
   * @returns 空响应体，表示登出流程已完成
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ログアウト' })
  async logout(@Req() req: AuthenticatedRequest) {
    await this.authService.logout(req.user.id);
    return null;
  }

  /**
   * 读取当前登录用户的角色与权限概要信息。
   *
   * @param req - 携带当前登录用户标识的认证请求对象
   * @returns 当前用户的展示信息、角色列表与权限编码集合
   */
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: '現在のユーザー情報取得' })
  async getProfile(@Req() req: AuthenticatedRequest) {
    return this.authService.getProfile(req.user.id);
  }

  /**
   * 校验旧密码后更新当前用户的登录密码。
   *
   * @param req - 携带当前登录用户标识的认证请求对象
   * @param dto - 包含旧密码和新密码的修改密码请求体
   * @returns 空响应体，表示密码已成功更新
   */
  @Put('change-password')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'パスワード変更' })
  async changePassword(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(
      req.user.id,
      dto.oldPassword,
      dto.newPassword,
    );
    return null;
  }
}
