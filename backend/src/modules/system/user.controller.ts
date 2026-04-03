import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { AuditActionType, AuditTargetType } from '../../common/constants/enums';
import { PermissionCodes } from '../../common/constants/permission-codes';
import { ApiResponse } from '../../common/helpers/api-response.helper';
import { Permissions } from '../auth/decorators';
import { AuditAction } from '../log/decorators';
import {
  CreateUserDto,
  QueryUserDto,
  ResetPasswordDto,
  UpdateUserDto,
} from './dto';
import { UserService } from './user.service';

@ApiTags('ユーザー管理')
@Controller('system/users')
@ApiBearerAuth()
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * 创建新的系统用户并绑定角色。
   *
   * @param dto - 包含用户名、密码、展示名和角色列表的创建参数
   * @returns 新建后的用户详情
   */
  @Post()
  @Permissions(PermissionCodes.SYSTEM_USER_MANAGE)
  @AuditAction({
    action: AuditActionType.CREATE,
    targetType: AuditTargetType.USER,
  })
  @ApiOperation({ summary: 'ユーザー新規作成' })
  async create(@Body() dto: CreateUserDto) {
    return this.userService.create(dto);
  }

  /**
   * 按筛选条件分页返回用户列表。
   *
   * @param query - 用户分页、状态、角色和排序查询参数
   * @returns 统一分页响应结构的用户列表结果
   */
  @Get()
  @Permissions(PermissionCodes.SYSTEM_USER_MANAGE)
  @ApiOperation({ summary: 'ユーザー一覧取得' })
  async findAll(@Query() query: QueryUserDto) {
    const result = await this.userService.findAll(query);

    return ApiResponse.paginated(
      result.items,
      result.total,
      result.page,
      result.pageSize,
    );
  }

  /**
   * 根据用户 ID 查询单个用户详情。
   *
   * @param id - 用户主键 UUID
   * @returns 包含角色摘要的用户详情
   */
  @Get(':id')
  @Permissions(PermissionCodes.SYSTEM_USER_MANAGE)
  @ApiOperation({ summary: 'ユーザー詳細取得' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.findOne(id);
  }

  /**
   * 更新指定用户的展示信息、状态和角色集合。
   *
   * @param id - 待更新用户的 UUID
   * @param dto - 允许变更的用户字段
   * @returns 更新后的用户详情
   */
  @Put(':id')
  @Permissions(PermissionCodes.SYSTEM_USER_MANAGE)
  @AuditAction({
    action: AuditActionType.UPDATE,
    targetType: AuditTargetType.USER,
  })
  @ApiOperation({ summary: 'ユーザー情報更新' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.userService.update(id, dto);
  }

  /**
   * 重置指定用户的登录密码。
   *
   * @param id - 目标用户的 UUID
   * @param dto - 新密码参数；省略时由服务层回退到默认重置密码
   * @returns 空响应体，表示密码已完成重置
   */
  @Put(':id/reset-password')
  @Permissions(PermissionCodes.SYSTEM_USER_MANAGE)
  @AuditAction({
    action: AuditActionType.PASSWORD_CHANGE,
    targetType: AuditTargetType.USER,
  })
  @ApiOperation({ summary: 'パスワードリセット' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetPasswordDto,
  ) {
    await this.userService.resetPassword(id, dto.newPassword);

    return null;
  }

  /**
   * 在启用和停用之间切换用户状态。
   *
   * @param id - 目标用户的 UUID
   * @returns 状态切换后的用户详情
   */
  @Put(':id/toggle-status')
  @Permissions(PermissionCodes.SYSTEM_USER_MANAGE)
  @AuditAction({
    action: AuditActionType.STATUS_CHANGE,
    targetType: AuditTargetType.USER,
  })
  @ApiOperation({ summary: 'ユーザーステータス切替（有効/無効）' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async toggleStatus(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.toggleStatus(id);
  }

  /**
   * 逻辑删除非系统管理员用户。
   *
   * @param id - 待删除用户的 UUID
   * @returns 空响应体，表示删除动作已完成
   */
  @Delete(':id')
  @Permissions(PermissionCodes.SYSTEM_USER_MANAGE)
  @AuditAction({
    action: AuditActionType.DELETE,
    targetType: AuditTargetType.USER,
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'ユーザー削除（論理削除）' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.userService.remove(id);

    return null;
  }
}
