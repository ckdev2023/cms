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
import { RoleService } from './role.service'
import { CreateRoleDto, UpdateRoleDto, QueryRoleDto } from './dto'
import { Permissions } from '../auth/decorators'
import { PermissionCodes } from '../../common/constants/permission-codes'
import { ApiResponse } from '../../common/helpers/api-response.helper'
import { AuditAction } from '../log/decorators'
import { AuditActionType, AuditTargetType } from '../../common/constants/enums'

@ApiTags('ロール管理')
@Controller('system/roles')
@ApiBearerAuth()
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Post()
  @Permissions(PermissionCodes.SYSTEM_ROLE_MANAGE)
  @AuditAction({ action: AuditActionType.CREATE, targetType: AuditTargetType.ROLE })
  @ApiOperation({ summary: 'ロール新規作成' })
  async create(@Body() dto: CreateRoleDto) {
    return this.roleService.create(dto)
  }

  @Get()
  @Permissions(PermissionCodes.SYSTEM_ROLE_MANAGE)
  @ApiOperation({ summary: 'ロール一覧取得' })
  async findAll(@Query() query: QueryRoleDto) {
    const result = await this.roleService.findAll(query)
    return ApiResponse.paginated(
      result.items,
      result.total,
      result.page,
      result.pageSize,
    )
  }

  @Get('permissions/tree')
  @Permissions(PermissionCodes.SYSTEM_ROLE_MANAGE)
  @ApiOperation({ summary: '権限ツリー取得（モジュール別グループ）' })
  async getPermissionTree() {
    return this.roleService.getAllPermissionsGrouped()
  }

  @Get(':id')
  @Permissions(PermissionCodes.SYSTEM_ROLE_MANAGE)
  @ApiOperation({ summary: 'ロール詳細取得' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.roleService.findOne(id)
  }

  @Put(':id')
  @Permissions(PermissionCodes.SYSTEM_ROLE_MANAGE)
  @AuditAction({ action: AuditActionType.UPDATE, targetType: AuditTargetType.ROLE })
  @ApiOperation({ summary: 'ロール情報更新' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.roleService.update(id, dto)
  }

  @Delete(':id')
  @Permissions(PermissionCodes.SYSTEM_ROLE_MANAGE)
  @AuditAction({ action: AuditActionType.DELETE, targetType: AuditTargetType.ROLE })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'ロール削除' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.roleService.remove(id)
    return null
  }
}
