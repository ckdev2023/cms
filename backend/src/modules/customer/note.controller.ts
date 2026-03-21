import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
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
import type { Request } from 'express'
import { NoteService } from './note.service'
import { CreateNoteDto, UpdateNoteDto, QueryNoteDto } from './dto'
import { Permissions } from '../auth/decorators'
import { PermissionCodes } from '../../common/constants/permission-codes'
import { ApiResponse } from '../../common/helpers/api-response.helper'
import { AuditAction } from '../log/decorators'
import { AuditActionType, AuditTargetType } from '../../common/constants/enums'

@ApiTags('顧客メモ')
@Controller('customers/:customerId/notes')
@ApiBearerAuth()
export class NoteController {
  constructor(private readonly noteService: NoteService) {}

  @Post()
  @Permissions(PermissionCodes.CUSTOMER_EDIT)
  @AuditAction({ action: AuditActionType.CREATE, targetType: AuditTargetType.NOTE })
  @ApiOperation({ summary: 'メモ新規作成' })
  @ApiParam({ name: 'customerId', type: 'string', format: 'uuid' })
  async create(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: CreateNoteDto,
    @Req() req: Request,
  ) {
    const userId = (req.user as { id: string }).id
    const note = await this.noteService.create(customerId, dto, userId)
    return note
  }

  @Get()
  @Permissions(PermissionCodes.CUSTOMER_DETAIL)
  @ApiOperation({ summary: 'メモ一覧取得' })
  @ApiParam({ name: 'customerId', type: 'string', format: 'uuid' })
  async findAll(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Query() query: QueryNoteDto,
  ) {
    const result = await this.noteService.findAll(customerId, query)
    return ApiResponse.paginated(
      result.items,
      result.total,
      result.page,
      result.pageSize,
    )
  }

  @Get(':id')
  @Permissions(PermissionCodes.CUSTOMER_DETAIL)
  @ApiOperation({ summary: 'メモ詳細取得' })
  @ApiParam({ name: 'customerId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async findOne(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.noteService.findOne(customerId, id)
  }

  @Put(':id')
  @Permissions(PermissionCodes.CUSTOMER_EDIT)
  @AuditAction({ action: AuditActionType.UPDATE, targetType: AuditTargetType.NOTE })
  @ApiOperation({ summary: 'メモ更新' })
  @ApiParam({ name: 'customerId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async update(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateNoteDto,
  ) {
    return this.noteService.update(customerId, id, dto)
  }

  @Delete(':id')
  @Permissions(PermissionCodes.CUSTOMER_DELETE)
  @AuditAction({ action: AuditActionType.DELETE, targetType: AuditTargetType.NOTE })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'メモ削除（論理削除）' })
  @ApiParam({ name: 'customerId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async remove(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.noteService.remove(customerId, id)
    return null
  }
}
