import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  ParseUUIDPipe,
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
import { PaymentService } from './payment.service'
import { CreatePaymentDto, QueryPaymentDto, ReversePaymentDto } from './dto'
import { Permissions } from '../auth/decorators'
import { PermissionCodes } from '../../common/constants/permission-codes'
import { ApiResponse } from '../../common/helpers/api-response.helper'
import {
  IdempotencyInterceptor,
  Idempotent,
} from '../../common/interceptors/idempotency.interceptor'
import { AuditAction } from '../log/decorators'
import { AuditActionType, AuditTargetType } from '../../common/constants/enums'

@ApiTags('入金')
@Controller('payments')
@ApiBearerAuth()
@UseInterceptors(IdempotencyInterceptor)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  @Permissions(PermissionCodes.FINANCE_CREATE)
  @Idempotent()
  @AuditAction({ action: AuditActionType.CREATE, targetType: AuditTargetType.PAYMENT })
  @ApiOperation({ summary: '入金登録' })
  @ApiHeader({
    name: 'x-idempotency-key',
    required: false,
    description: '冪等キー',
  })
  async create(@Body() dto: CreatePaymentDto, @Req() req: Request) {
    const userId = (req.user as { id: string }).id
    const payment = await this.paymentService.create(dto, userId)
    return ApiResponse.success(payment)
  }

  @Get()
  @Permissions(PermissionCodes.FINANCE_LIST)
  @ApiOperation({ summary: '入金一覧取得' })
  async findAll(@Query() query: QueryPaymentDto) {
    const result = await this.paymentService.findAll(query)
    return ApiResponse.paginated(
      result.items,
      result.total,
      result.page,
      result.pageSize,
    )
  }

  @Get('summary')
  @Permissions(PermissionCodes.FINANCE_LIST)
  @ApiOperation({ summary: '入金集計情報' })
  async summary(@Query('customerId') customerId?: string) {
    const data = await this.paymentService.getSummary(customerId)
    return ApiResponse.success(data)
  }

  @Get('by-invoice/:invoiceId')
  @Permissions(PermissionCodes.FINANCE_DETAIL)
  @ApiOperation({ summary: '請求書に紐づく入金一覧' })
  @ApiParam({ name: 'invoiceId', type: 'string', format: 'uuid' })
  async findByInvoice(
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
  ) {
    const data = await this.paymentService.findByInvoice(invoiceId)
    return ApiResponse.success(data)
  }

  @Get(':id')
  @Permissions(PermissionCodes.FINANCE_DETAIL)
  @ApiOperation({ summary: '入金詳細取得' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const payment = await this.paymentService.findOne(id)
    return ApiResponse.success(payment)
  }

  @Patch(':id/reverse')
  @Permissions(PermissionCodes.FINANCE_VOID)
  @Idempotent()
  @AuditAction({ action: AuditActionType.VOID, targetType: AuditTargetType.PAYMENT })
  @ApiOperation({ summary: '入金取消（冲正）' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiHeader({
    name: 'x-idempotency-key',
    required: false,
    description: '冪等キー',
  })
  async reverse(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReversePaymentDto,
    @Req() req: Request,
  ) {
    const userId = (req.user as { id: string }).id
    const payment = await this.paymentService.reverse(id, dto, userId)
    return ApiResponse.success(payment)
  }
}
