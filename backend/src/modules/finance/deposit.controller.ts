import {
  Controller,
  Get,
  Post,
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
import { DepositService } from './deposit.service'
import {
  CreateDepositRechargeDto,
  CreateDepositOffsetDto,
  CreateDepositRefundDto,
  CreateDepositAdjustmentDto,
  QueryDepositAccountDto,
  QueryDepositTransactionDto,
} from './dto'
import { Permissions } from '../auth/decorators'
import { PermissionCodes } from '../../common/constants/permission-codes'
import { ApiResponse } from '../../common/helpers/api-response.helper'
import {
  IdempotencyInterceptor,
  Idempotent,
} from '../../common/interceptors/idempotency.interceptor'
import { AuditAction } from '../log/decorators'
import { AuditActionType, AuditTargetType } from '../../common/constants/enums'

@ApiTags('預り金')
@Controller('deposits')
@ApiBearerAuth()
@UseInterceptors(IdempotencyInterceptor)
export class DepositController {
  constructor(private readonly depositService: DepositService) {}

  /* ──── Account endpoints ──── */

  @Get()
  @Permissions(PermissionCodes.FINANCE_LIST)
  @ApiOperation({ summary: '預り金アカウント一覧' })
  async findAllAccounts(@Query() query: QueryDepositAccountDto) {
    const result = await this.depositService.findAllAccounts(query)
    return ApiResponse.paginated(
      result.items,
      result.total,
      result.page,
      result.pageSize,
    )
  }

  @Get('summary')
  @Permissions(PermissionCodes.FINANCE_LIST)
  @ApiOperation({ summary: '預り金集計情報' })
  async summary() {
    const data = await this.depositService.getAccountSummary()
    return ApiResponse.success(data)
  }

  @Get('transactions')
  @Permissions(PermissionCodes.FINANCE_LIST)
  @ApiOperation({ summary: '全取引履歴' })
  async findAllTransactions(@Query() query: QueryDepositTransactionDto) {
    const result = await this.depositService.findAllTransactions(query)
    return ApiResponse.paginated(
      result.items,
      result.total,
      result.page,
      result.pageSize,
    )
  }

  @Get('by-customer/:customerId')
  @Permissions(PermissionCodes.FINANCE_DETAIL)
  @ApiOperation({ summary: '顧客の預り金アカウント取得' })
  @ApiParam({ name: 'customerId', type: 'string', format: 'uuid' })
  async findByCustomer(
    @Param('customerId', ParseUUIDPipe) customerId: string,
  ) {
    const account = await this.depositService.findAccountByCustomer(customerId)
    return ApiResponse.success(account)
  }

  @Get(':id')
  @Permissions(PermissionCodes.FINANCE_DETAIL)
  @ApiOperation({ summary: '預り金アカウント詳細' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async findAccount(@Param('id', ParseUUIDPipe) id: string) {
    const account = await this.depositService.findAccountById(id)
    return ApiResponse.success(account)
  }

  @Get(':id/transactions')
  @Permissions(PermissionCodes.FINANCE_DETAIL)
  @ApiOperation({ summary: 'アカウントの取引履歴' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async findAccountTransactions(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: QueryDepositTransactionDto,
  ) {
    const result = await this.depositService.findTransactionsByAccount(
      id,
      query,
    )
    return ApiResponse.paginated(
      result.items,
      result.total,
      result.page,
      result.pageSize,
    )
  }

  /* ──── Mutation endpoints ──── */

  @Post('recharge')
  @Permissions(PermissionCodes.FINANCE_CREATE)
  @Idempotent()
  @AuditAction({
    action: AuditActionType.CREATE,
    targetType: AuditTargetType.DEPOSIT,
  })
  @ApiOperation({ summary: '預り金チャージ' })
  @ApiHeader({
    name: 'x-idempotency-key',
    required: false,
    description: '冪等キー',
  })
  async recharge(@Body() dto: CreateDepositRechargeDto, @Req() req: Request) {
    const userId = (req.user as { id: string }).id
    const txn = await this.depositService.recharge(dto, userId)
    return ApiResponse.success(txn)
  }

  @Post('offset')
  @Permissions(PermissionCodes.FINANCE_CREATE)
  @Idempotent()
  @AuditAction({
    action: AuditActionType.CREATE,
    targetType: AuditTargetType.DEPOSIT,
  })
  @ApiOperation({ summary: '預り金充当（請求書への充当）' })
  @ApiHeader({
    name: 'x-idempotency-key',
    required: false,
    description: '冪等キー',
  })
  async offset(@Body() dto: CreateDepositOffsetDto, @Req() req: Request) {
    const userId = (req.user as { id: string }).id
    const txn = await this.depositService.offset(dto, userId)
    return ApiResponse.success(txn)
  }

  @Post('refund')
  @Permissions(PermissionCodes.FINANCE_CREATE)
  @Idempotent()
  @AuditAction({
    action: AuditActionType.CREATE,
    targetType: AuditTargetType.DEPOSIT,
  })
  @ApiOperation({ summary: '預り金返金' })
  @ApiHeader({
    name: 'x-idempotency-key',
    required: false,
    description: '冪等キー',
  })
  async refund(@Body() dto: CreateDepositRefundDto, @Req() req: Request) {
    const userId = (req.user as { id: string }).id
    const txn = await this.depositService.refund(dto, userId)
    return ApiResponse.success(txn)
  }

  @Post('adjustment')
  @Permissions(PermissionCodes.FINANCE_EDIT)
  @Idempotent()
  @AuditAction({
    action: AuditActionType.UPDATE,
    targetType: AuditTargetType.DEPOSIT,
  })
  @ApiOperation({ summary: '預り金調整' })
  @ApiHeader({
    name: 'x-idempotency-key',
    required: false,
    description: '冪等キー',
  })
  async adjustment(
    @Body() dto: CreateDepositAdjustmentDto,
    @Req() req: Request,
  ) {
    const userId = (req.user as { id: string }).id
    const txn = await this.depositService.adjustment(dto, userId)
    return ApiResponse.success(txn)
  }
}
