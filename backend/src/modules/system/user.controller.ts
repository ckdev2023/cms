import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger'
import { UserService } from './user.service'
import { CreateUserDto, UpdateUserDto, QueryUserDto, ResetPasswordDto } from './dto'
import { Permissions } from '../auth/decorators'
import { PermissionCodes } from '../../common/constants/permission-codes'
import { ApiResponse } from '../../common/helpers/api-response.helper'
import { AuditAction } from '../log/decorators'
import { AuditActionType, AuditTargetType } from '../../common/constants/enums'

@ApiTags('ユーザー管理')
@Controller('system/users')
@ApiBearerAuth()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @Permissions(PermissionCodes.SYSTEM_USER_MANAGE)
  @AuditAction({ action: AuditActionType.CREATE, targetType: AuditTargetType.USER })
  @ApiOperation({ summary: 'ユーザー新規作成' })
  async create(@Body() dto: CreateUserDto) {
    return this.userService.create(dto)
  }

  @Get()
  @Permissions(PermissionCodes.SYSTEM_USER_MANAGE)
  @ApiOperation({ summary: 'ユーザー一覧取得' })
  async findAll(@Query() query: QueryUserDto) {
    const result = await this.userService.findAll(query)
    return ApiResponse.paginated(
      result.items,
      result.total,
      result.page,
      result.pageSize,
    )
  }

  @Get(':id')
  @Permissions(PermissionCodes.SYSTEM_USER_MANAGE)
  @ApiOperation({ summary: 'ユーザー詳細取得' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.findOne(id)
  }

  @Put(':id')
  @Permissions(PermissionCodes.SYSTEM_USER_MANAGE)
  @AuditAction({ action: AuditActionType.UPDATE, targetType: AuditTargetType.USER })
  @ApiOperation({ summary: 'ユーザー情報更新' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.userService.update(id, dto)
  }

  @Put(':id/reset-password')
  @Permissions(PermissionCodes.SYSTEM_USER_MANAGE)
  @AuditAction({ action: AuditActionType.PASSWORD_CHANGE, targetType: AuditTargetType.USER })
  @ApiOperation({ summary: 'パスワードリセット' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetPasswordDto,
  ) {
    await this.userService.resetPassword(id, dto.newPassword)
    return null
  }

  @Put(':id/toggle-status')
  @Permissions(PermissionCodes.SYSTEM_USER_MANAGE)
  @AuditAction({ action: AuditActionType.STATUS_CHANGE, targetType: AuditTargetType.USER })
  @ApiOperation({ summary: 'ユーザーステータス切替（有効/無効）' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async toggleStatus(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.toggleStatus(id)
  }

  @Delete(':id')
  @Permissions(PermissionCodes.SYSTEM_USER_MANAGE)
  @AuditAction({ action: AuditActionType.DELETE, targetType: AuditTargetType.USER })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'ユーザー削除（論理削除）' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.userService.remove(id)
    return null
  }
}
