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
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { AuditActionType, AuditTargetType } from '../../common/constants/enums';
import { PermissionCodes } from '../../common/constants/permission-codes';
import { ApiResponse } from '../../common/helpers/api-response.helper';
import { Permissions } from '../auth/decorators';
import { AuditAction } from '../log/decorators';
import { CreateNoteDto, QueryNoteDto, UpdateNoteDto } from './dto';
import { NoteService } from './note.service';

type AuthenticatedRequest = Request & { user: { id: string } };

@ApiTags('顧客メモ')
@Controller('customers/:customerId/notes')
@ApiBearerAuth()
export class NoteController {
  constructor(private readonly noteService: NoteService) {}

  /**
   * 为指定客户新增备注并记录操作人。
   *
   * @param customerId - 路由中传入的客户主键 ID
   * @param dto - 包含备注内容和类型的创建请求体
   * @param req - 携带当前登录用户 ID 的认证请求对象
   * @returns 新创建且带创建人信息的备注实体
   */
  @Post()
  @Permissions(PermissionCodes.CUSTOMER_EDIT)
  @AuditAction({
    action: AuditActionType.CREATE,
    targetType: AuditTargetType.NOTE,
  })
  @ApiOperation({ summary: 'メモ新規作成' })
  @ApiParam({ name: 'customerId', type: 'string', format: 'uuid' })
  async create(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: CreateNoteDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.noteService.create(customerId, dto, req.user.id);
  }

  /**
   * 分页读取指定客户的备注列表。
   *
   * @param customerId - 路由中传入的客户主键 ID
   * @param query - 备注分页、过滤与排序查询参数
   * @returns 符合统一分页结构的备注列表响应体
   */
  @Get()
  @Permissions(PermissionCodes.CUSTOMER_DETAIL)
  @ApiOperation({ summary: 'メモ一覧取得' })
  @ApiParam({ name: 'customerId', type: 'string', format: 'uuid' })
  async findAll(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Query() query: QueryNoteDto,
  ) {
    const result = await this.noteService.findAll(customerId, query);
    return ApiResponse.paginated(
      result.items,
      result.total,
      result.page,
      result.pageSize,
    );
  }

  /**
   * 读取单条客户备注详情。
   *
   * @param customerId - 路由中传入的客户主键 ID
   * @param id - 备注主键 ID
   * @returns 指定客户范围下的备注详情
   */
  @Get(':id')
  @Permissions(PermissionCodes.CUSTOMER_DETAIL)
  @ApiOperation({ summary: 'メモ詳細取得' })
  @ApiParam({ name: 'customerId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async findOne(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.noteService.findOne(customerId, id);
  }

  /**
   * 更新指定客户备注的内容或备注类型。
   *
   * @param customerId - 路由中传入的客户主键 ID
   * @param id - 备注主键 ID
   * @param dto - 备注更新请求体
   * @returns 更新完成后的备注详情
   */
  @Put(':id')
  @Permissions(PermissionCodes.CUSTOMER_EDIT)
  @AuditAction({
    action: AuditActionType.UPDATE,
    targetType: AuditTargetType.NOTE,
  })
  @ApiOperation({ summary: 'メモ更新' })
  @ApiParam({ name: 'customerId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async update(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateNoteDto,
  ) {
    return this.noteService.update(customerId, id, dto);
  }

  /**
   * 对指定客户备注执行逻辑删除。
   *
   * @param customerId - 路由中传入的客户主键 ID
   * @param id - 备注主键 ID
   * @returns 空响应体，表示逻辑删除已完成
   */
  @Delete(':id')
  @Permissions(PermissionCodes.CUSTOMER_DELETE)
  @AuditAction({
    action: AuditActionType.DELETE,
    targetType: AuditTargetType.NOTE,
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'メモ削除（論理削除）' })
  @ApiParam({ name: 'customerId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async remove(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.noteService.remove(customerId, id);
    return null;
  }
}
