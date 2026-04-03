import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { CreatePaymentDto, QueryPaymentDto, ReversePaymentDto } from './dto';
import { PaymentService } from './payment.service';

type AuthenticatedRequest = Request & { user: { id: string } };

/**
 * 提供入金登记、查询、汇总与冲正接口。
 */
@ApiTags('入金')
@Controller('payments')
@ApiBearerAuth()
@UseInterceptors(IdempotencyInterceptor)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * 登记一笔入金并按分配明细回写请求书状态。
   *
   * @param dto - 入金主表与分配明细入参
   * @param req - 当前登录请求，用于提取操作人 ID
   * @returns 标准成功响应体，包含登记后的入金详情
   */
  @Post()
  @Permissions(PermissionCodes.FINANCE_CREATE)
  @Idempotent()
  @AuditAction({
    action: AuditActionType.CREATE,
    targetType: AuditTargetType.PAYMENT,
  })
  @ApiOperation({ summary: '入金登録' })
  @ApiHeader({
    name: 'x-idempotency-key',
    required: false,
    description: '冪等キー',
  })
  async create(@Body() dto: CreatePaymentDto, @Req() req: Request) {
    const userId = (req as AuthenticatedRequest).user.id;
    const payment = await this.paymentService.create(dto, userId);
    return ApiResponse.success(payment);
  }

  /**
   * 按筛选条件分页查询入金列表。
   *
   * @param query - 分页、客户、状态与日期筛选条件
   * @returns 标准分页响应体，包含入金概要列表
   */
  @Get()
  @Permissions(PermissionCodes.FINANCE_LIST)
  @ApiOperation({ summary: '入金一覧取得' })
  async findAll(@Query() query: QueryPaymentDto) {
    const result = await this.paymentService.findAll(query);
    return ApiResponse.paginated(
      result.items,
      result.total,
      result.page,
      result.pageSize,
    );
  }

  /**
   * 汇总入金状态分布和金额统计。
   *
   * @param customerId - 可选客户 ID；传入后仅统计该客户的入金
   * @returns 标准成功响应体，包含按状态分组的统计结果
   */
  @Get('summary')
  @Permissions(PermissionCodes.FINANCE_LIST)
  @ApiOperation({ summary: '入金集計情報' })
  async summary(@Query('customerId') customerId?: string) {
    const data = await this.paymentService.getSummary(customerId);
    return ApiResponse.success(data);
  }

  /**
   * 查询某张请求书已关联的入金分配记录。
   *
   * @param invoiceId - 请求书主键 ID
   * @returns 标准成功响应体，包含该请求书的入金分配列表
   */
  @Get('by-invoice/:invoiceId')
  @Permissions(PermissionCodes.FINANCE_DETAIL)
  @ApiOperation({ summary: '請求書に紐づく入金一覧' })
  @ApiParam({ name: 'invoiceId', type: 'string', format: 'uuid' })
  async findByInvoice(@Param('invoiceId', ParseUUIDPipe) invoiceId: string) {
    const data = await this.paymentService.findByInvoice(invoiceId);
    return ApiResponse.success(data);
  }

  /**
   * 根据入金 ID 读取入金详情。
   *
   * @param id - 入金主键 ID
   * @returns 标准成功响应体，包含入金详情
   */
  @Get(':id')
  @Permissions(PermissionCodes.FINANCE_DETAIL)
  @ApiOperation({ summary: '入金詳細取得' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const payment = await this.paymentService.findOne(id);
    return ApiResponse.success(payment);
  }

  /**
   * 冲正指定入金并回滚其对应的请求书分配关系。
   *
   * @param id - 入金主键 ID
   * @param dto - 冲正原因入参
   * @param req - 当前登录请求，用于提取操作人 ID
   * @returns 标准成功响应体，包含冲正后的入金详情
   */
  @Patch(':id/reverse')
  @Permissions(PermissionCodes.FINANCE_VOID)
  @Idempotent()
  @AuditAction({
    action: AuditActionType.VOID,
    targetType: AuditTargetType.PAYMENT,
  })
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
    const userId = (req as AuthenticatedRequest).user.id;
    const payment = await this.paymentService.reverse(id, dto, userId);
    return ApiResponse.success(payment);
  }
}
