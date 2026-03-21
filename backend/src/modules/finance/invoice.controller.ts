import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseInterceptors,
} from '@nestjs/common'
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiHeader,
} from '@nestjs/swagger'
import type { Request } from 'express'
import { InvoiceService } from './invoice.service'
import {
  CreateInvoiceDto,
  UpdateInvoiceDto,
  QueryInvoiceDto,
  UpdateInvoiceStatusDto,
  VoidInvoiceDto,
} from './dto'
import { Permissions } from '../auth/decorators'
import { PermissionCodes } from '../../common/constants/permission-codes'
import { ApiResponse } from '../../common/helpers/api-response.helper'
import {
  IdempotencyInterceptor,
  Idempotent,
} from '../../common/interceptors/idempotency.interceptor'
import { Reflector } from '@nestjs/core'
import { AuditAction } from '../log/decorators'
import { AuditActionType, AuditTargetType } from '../../common/constants/enums'

@ApiTags('請求書')
@Controller('invoices')
@ApiBearerAuth()
@UseInterceptors(IdempotencyInterceptor)
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Post()
  @Permissions(PermissionCodes.FINANCE_CREATE)
  @Idempotent()
  @AuditAction({ action: AuditActionType.CREATE, targetType: AuditTargetType.INVOICE })
  @ApiOperation({ summary: '請求書新規作成' })
  @ApiHeader({ name: 'x-idempotency-key', required: false, description: '冪等キー' })
  async create(@Body() dto: CreateInvoiceDto, @Req() req: Request) {
    const userId = (req.user as { id: string }).id
    const invoice = await this.invoiceService.create(dto, userId)
    return ApiResponse.success(invoice)
  }

  @Get()
  @Permissions(PermissionCodes.FINANCE_LIST)
  @ApiOperation({ summary: '請求書一覧取得' })
  async findAll(@Query() query: QueryInvoiceDto) {
    const result = await this.invoiceService.findAll(query)
    return ApiResponse.paginated(
      result.items,
      result.total,
      result.page,
      result.pageSize,
    )
  }

  @Get('summary')
  @Permissions(PermissionCodes.FINANCE_LIST)
  @ApiOperation({ summary: '請求書集計情報' })
  async summary(@Query('customerId') customerId?: string) {
    const data = await this.invoiceService.getSummary(customerId)
    return ApiResponse.success(data)
  }

  @Get(':id')
  @Permissions(PermissionCodes.FINANCE_DETAIL)
  @ApiOperation({ summary: '請求書詳細取得' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const invoice = await this.invoiceService.findOne(id)
    return ApiResponse.success(invoice)
  }

  @Put(':id')
  @Permissions(PermissionCodes.FINANCE_EDIT)
  @Idempotent()
  @AuditAction({ action: AuditActionType.UPDATE, targetType: AuditTargetType.INVOICE })
  @ApiOperation({ summary: '請求書更新（下書きのみ）' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiHeader({ name: 'x-idempotency-key', required: false, description: '冪等キー' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInvoiceDto,
    @Req() req: Request,
  ) {
    const userId = (req.user as { id: string }).id
    const invoice = await this.invoiceService.update(id, dto, userId)
    return ApiResponse.success(invoice)
  }

  @Patch(':id/status')
  @Permissions(PermissionCodes.FINANCE_EDIT)
  @AuditAction({ action: AuditActionType.STATUS_CHANGE, targetType: AuditTargetType.INVOICE })
  @ApiOperation({ summary: '請求書ステータス変更' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInvoiceStatusDto,
    @Req() req: Request,
  ) {
    const userId = (req.user as { id: string }).id
    const invoice = await this.invoiceService.updateStatus(id, dto.status, userId)
    return ApiResponse.success(invoice)
  }

  @Patch(':id/void')
  @Permissions(PermissionCodes.FINANCE_VOID)
  @Idempotent()
  @AuditAction({ action: AuditActionType.VOID, targetType: AuditTargetType.INVOICE })
  @ApiOperation({ summary: '請求書無効化（作廃）' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiHeader({ name: 'x-idempotency-key', required: false, description: '冪等キー' })
  async voidInvoice(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VoidInvoiceDto,
    @Req() req: Request,
  ) {
    const userId = (req.user as { id: string }).id
    const invoice = await this.invoiceService.voidInvoice(id, dto, userId)
    return ApiResponse.success(invoice)
  }

  @Get(':id/transitions')
  @Permissions(PermissionCodes.FINANCE_DETAIL)
  @ApiOperation({ summary: '請求書の遷移可能なステータス一覧' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async getTransitions(@Param('id', ParseUUIDPipe) id: string) {
    const invoice = await this.invoiceService.findOne(id)
    return ApiResponse.success(
      this.invoiceService.getAvailableTransitions(invoice.status),
    )
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Permissions(PermissionCodes.FINANCE_DELETE)
  @AuditAction({ action: AuditActionType.DELETE, targetType: AuditTargetType.INVOICE })
  @ApiOperation({ summary: '請求書削除（論理削除・下書きのみ）' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.invoiceService.remove(id)
    return null
  }

  @Patch(':id/restore')
  @Permissions(PermissionCodes.FINANCE_EDIT)
  @AuditAction({ action: AuditActionType.RESTORE, targetType: AuditTargetType.INVOICE })
  @ApiOperation({ summary: '請求書復元（論理削除からの復元）' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async restore(@Param('id', ParseUUIDPipe) id: string) {
    const invoice = await this.invoiceService.restore(id)
    return ApiResponse.success(invoice)
  }
}
