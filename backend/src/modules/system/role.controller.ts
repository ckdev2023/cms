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
import { CreateRoleDto, QueryRoleDto, UpdateRoleDto } from './dto';
import { RoleService } from './role.service';

@ApiTags('ロール管理')
@Controller('system/roles')
@ApiBearerAuth()
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  /**
   * 创建新的业务角色并绑定权限集合。
   *
   * @param dto - 包含角色编码、名称和权限 ID 列表的创建参数
   * @returns 新建后的角色详情
   */
  @Post()
  @Permissions(PermissionCodes.SYSTEM_ROLE_MANAGE)
  @AuditAction({
    action: AuditActionType.CREATE,
    targetType: AuditTargetType.ROLE,
  })
  @ApiOperation({ summary: 'ロール新規作成' })
  async create(@Body() dto: CreateRoleDto) {
    return this.roleService.create(dto);
  }

  /**
   * 按筛选条件分页返回角色列表。
   *
   * @param query - 角色分页、关键字和排序查询参数
   * @returns 统一分页响应结构的角色列表结果
   */
  @Get()
  @Permissions(PermissionCodes.SYSTEM_ROLE_MANAGE)
  @ApiOperation({ summary: 'ロール一覧取得' })
  async findAll(@Query() query: QueryRoleDto) {
    const result = await this.roleService.findAll(query);

    return ApiResponse.paginated(
      result.items,
      result.total,
      result.page,
      result.pageSize,
    );
  }

  /**
   * 返回按模块分组的全部权限树结构。
   *
   * @returns 供角色表单渲染权限树的模块分组结果
   */
  @Get('permissions/tree')
  @Permissions(PermissionCodes.SYSTEM_ROLE_MANAGE)
  @ApiOperation({ summary: '権限ツリー取得（モジュール別グループ）' })
  async getPermissionTree() {
    return this.roleService.getAllPermissionsGrouped();
  }

  /**
   * 根据角色 ID 查询单个角色详情。
   *
   * @param id - 角色主键 UUID
   * @returns 包含权限列表的角色详情
   */
  @Get(':id')
  @Permissions(PermissionCodes.SYSTEM_ROLE_MANAGE)
  @ApiOperation({ summary: 'ロール詳細取得' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.roleService.findOne(id);
  }

  /**
   * 更新指定角色的名称、描述和权限集合。
   *
   * @param id - 待更新角色的 UUID
   * @param dto - 允许变更的角色字段
   * @returns 更新后的角色详情
   */
  @Put(':id')
  @Permissions(PermissionCodes.SYSTEM_ROLE_MANAGE)
  @AuditAction({
    action: AuditActionType.UPDATE,
    targetType: AuditTargetType.ROLE,
  })
  @ApiOperation({ summary: 'ロール情報更新' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.roleService.update(id, dto);
  }

  /**
   * 删除非系统内置角色。
   *
   * @param id - 待删除角色的 UUID
   * @returns 空响应体，表示删除动作已完成
   */
  @Delete(':id')
  @Permissions(PermissionCodes.SYSTEM_ROLE_MANAGE)
  @AuditAction({
    action: AuditActionType.DELETE,
    targetType: AuditTargetType.ROLE,
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'ロール削除' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.roleService.remove(id);

    return null;
  }
}
