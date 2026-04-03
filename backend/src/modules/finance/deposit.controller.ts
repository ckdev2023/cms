import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { AuditActionType, AuditTargetType } from '../../common/constants/enums';
import { PermissionCodes } from '../../common/constants/permission-codes';
import { ApiResponse } from '../../common/helpers/api-response.helper';
import {
  IdempotencyInterceptor,
  Idempotent,
} from '../../common/interceptors/idempotency.interceptor';
import { Permissions } from '../auth/decorators';
import { AuditAction } from '../log/decorators';
import { DepositService } from './deposit.service';
import {
  CreateDepositAdjustmentDto,
  CreateDepositOffsetDto,
  CreateDepositRechargeDto,
  CreateDepositRefundDto,
  QueryDepositAccountDto,
  QueryDepositTransactionDto,
} from './dto';

type AuthenticatedRequest = Request & { user: { id: string } };

/**
 * 提供预り金账户、交易流水与余额变更的财务接口入口。
 */
@ApiTags('預り金')
@Controller('deposits')
@ApiBearerAuth()
@UseInterceptors(IdempotencyInterceptor)
export class DepositController {
  constructor(private readonly depositService: DepositService) {}

  /* ──── Account endpoints ──── */

  /**
   * 按筛选条件分页查询预り金账户列表。
   *
   * @param query - 账户分页、客户筛选与排序条件
   * @returns 标准分页响应体，包含账户概要列表与分页信息
   */
  @Get()
  @Permissions(PermissionCodes.FINANCE_LIST)
  @ApiOperation({ summary: '預り金アカウント一覧' })
  async findAllAccounts(@Query() query: QueryDepositAccountDto) {
    const result = await this.depositService.findAllAccounts(query);
    return ApiResponse.paginated(
      result.items,
      result.total,
      result.page,
      result.pageSize,
    );
  }

  /**
   * 汇总当前预り金账户数量、活跃账户数与余额总额。
   *
   * @returns 标准成功响应体，包含账户级统计结果
   */
  @Get('summary')
  @Permissions(PermissionCodes.FINANCE_LIST)
  @ApiOperation({ summary: '預り金集計情報' })
  async summary() {
    const data = await this.depositService.getAccountSummary();
    return ApiResponse.success(data);
  }

  /**
   * 按筛选条件分页查询全局预り金交易流水。
   *
   * @param query - 交易分页、客户、发票与日期筛选条件
   * @returns 标准分页响应体，包含交易列表与分页信息
   */
  @Get('transactions')
  @Permissions(PermissionCodes.FINANCE_LIST)
  @ApiOperation({ summary: '全取引履歴' })
  async findAllTransactions(@Query() query: QueryDepositTransactionDto) {
    const result = await this.depositService.findAllTransactions(query);
    return ApiResponse.paginated(
      result.items,
      result.total,
      result.page,
      result.pageSize,
    );
  }

  /**
   * 根据客户 ID 读取对应的预り金账户。
   *
   * @param customerId - 客户主键 ID
   * @returns 标准成功响应体；客户尚未建立账户时 data 为 null
   */
  @Get('by-customer/:customerId')
  @Permissions(PermissionCodes.FINANCE_DETAIL)
  @ApiOperation({ summary: '顧客の預り金アカウント取得' })
  @ApiParam({ name: 'customerId', type: 'string', format: 'uuid' })
  async findByCustomer(@Param('customerId', ParseUUIDPipe) customerId: string) {
    const account = await this.depositService.findAccountByCustomer(customerId);
    return ApiResponse.success(account);
  }

  /**
   * 根据账户 ID 读取预り金账户详情。
   *
   * @param id - 预り金账户主键 ID
   * @returns 标准成功响应体，包含账户详情
   */
  @Get(':id')
  @Permissions(PermissionCodes.FINANCE_DETAIL)
  @ApiOperation({ summary: '預り金アカウント詳細' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async findAccount(@Param('id', ParseUUIDPipe) id: string) {
    const account = await this.depositService.findAccountById(id);
    return ApiResponse.success(account);
  }

  /**
   * 根据账户 ID 分页查询该账户的交易流水。
   *
   * @param id - 预り金账户主键 ID
   * @param query - 交易分页、类型与日期筛选条件
   * @returns 标准分页响应体，包含账户交易列表
   */
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
    );
    return ApiResponse.paginated(
      result.items,
      result.total,
      result.page,
      result.pageSize,
    );
  }

  /* ──── Mutation endpoints ──── */

  /**
   * 为指定客户追加一笔预り金充值交易。
   *
   * @param dto - 充值金额、客户和备注等入参
   * @param req - 当前登录请求，用于提取操作人 ID
   * @returns 标准成功响应体，包含新建的充值交易详情
   */
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
    const userId = (req as AuthenticatedRequest).user.id;
    const txn = await this.depositService.recharge(dto, userId);
    return ApiResponse.success(txn);
  }

  /**
   * 将客户预り金充当到指定请求书并返回交易结果。
   *
   * @param dto - 充当金额、客户与目标请求书入参
   * @param req - 当前登录请求，用于提取操作人 ID
   * @returns 标准成功响应体，包含新建的充当交易详情
   */
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
    const userId = (req as AuthenticatedRequest).user.id;
    const txn = await this.depositService.offset(dto, userId);
    return ApiResponse.success(txn);
  }

  /**
   * 从客户预り金余额中执行返金并记录交易流水。
   *
   * @param dto - 返金额度、客户与返金原因
   * @param req - 当前登录请求，用于提取操作人 ID
   * @returns 标准成功响应体，包含新建的返金交易详情
   */
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
    const userId = (req as AuthenticatedRequest).user.id;
    const txn = await this.depositService.refund(dto, userId);
    return ApiResponse.success(txn);
  }

  /**
   * 对客户预り金余额执行人工增减调整。
   *
   * @param dto - 调整金额、客户与调整原因
   * @param req - 当前登录请求，用于提取操作人 ID
   * @returns 标准成功响应体，包含新建的调整交易详情
   */
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
    const userId = (req as AuthenticatedRequest).user.id;
    const txn = await this.depositService.adjustment(dto, userId);
    return ApiResponse.success(txn);
  }
}
