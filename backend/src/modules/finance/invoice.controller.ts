import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
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
import {
  CreateInvoiceDto,
  QueryInvoiceDto,
  UpdateInvoiceDto,
  UpdateInvoiceStatusDto,
  VoidInvoiceDto,
} from './dto';
import { InvoiceService } from './invoice.service';

type AuthenticatedRequest = Request & { user: { id: string } };

/**
 * 提供请求书的创建、查询、状态流转与作废接口。
 */
@ApiTags('請求書')
@Controller('invoices')
@ApiBearerAuth()
@UseInterceptors(IdempotencyInterceptor)
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  /**
   * 创建一张新的下书き状态请求书。
   *
   * @param dto - 请求书主表与行项目入参
   * @param req - 当前登录请求，用于提取操作人 ID
   * @returns 标准成功响应体，包含创建后的请求书详情
   */
  @Post()
  @Permissions(PermissionCodes.FINANCE_CREATE)
  @Idempotent()
  @AuditAction({
    action: AuditActionType.CREATE,
    targetType: AuditTargetType.INVOICE,
  })
  @ApiOperation({ summary: '請求書新規作成' })
  @ApiHeader({
    name: 'x-idempotency-key',
    required: false,
    description: '冪等キー',
  })
  async create(@Body() dto: CreateInvoiceDto, @Req() req: Request) {
    const userId = (req as AuthenticatedRequest).user.id;
    const invoice = await this.invoiceService.create(dto, userId);
    return ApiResponse.success(invoice);
  }

  /**
   * 按筛选条件分页查询请求书列表。
   *
   * @param query - 分页、客户、状态与排序条件
   * @returns 标准分页响应体，包含请求书概要列表
   */
  @Get()
  @Permissions(PermissionCodes.FINANCE_LIST)
  @ApiOperation({ summary: '請求書一覧取得' })
  async findAll(@Query() query: QueryInvoiceDto) {
    const result = await this.invoiceService.findAll(query);
    return ApiResponse.paginated(
      result.items,
      result.total,
      result.page,
      result.pageSize,
    );
  }

  /**
   * 汇总请求书状态分布和金额统计。
   *
   * @param customerId - 可选客户 ID；传入后仅统计该客户的请求书
   * @returns 标准成功响应体，包含按状态分组的统计结果
   */
  @Get('summary')
  @Permissions(PermissionCodes.FINANCE_LIST)
  @ApiOperation({ summary: '請求書集計情報' })
  async summary(@Query('customerId') customerId?: string) {
    const data = await this.invoiceService.getSummary(customerId);
    return ApiResponse.success(data);
  }

  /**
   * 根据请求书 ID 读取明细。
   *
   * @param id - 请求书主键 ID
   * @returns 标准成功响应体，包含请求书详情
   */
  @Get(':id')
  @Permissions(PermissionCodes.FINANCE_DETAIL)
  @ApiOperation({ summary: '請求書詳細取得' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const invoice = await this.invoiceService.findOne(id);
    return ApiResponse.success(invoice);
  }

  /**
   * 更新下书き状态请求书的字段与行项目。
   *
   * @param id - 请求书主键 ID
   * @param dto - 可更新字段与行项目入参
   * @param req - 当前登录请求，用于提取操作人 ID
   * @returns 标准成功响应体，包含更新后的请求书详情
   */
  @Put(':id')
  @Permissions(PermissionCodes.FINANCE_EDIT)
  @Idempotent()
  @AuditAction({
    action: AuditActionType.UPDATE,
    targetType: AuditTargetType.INVOICE,
  })
  @ApiOperation({ summary: '請求書更新（下書きのみ）' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiHeader({
    name: 'x-idempotency-key',
    required: false,
    description: '冪等キー',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInvoiceDto,
    @Req() req: Request,
  ) {
    const userId = (req as AuthenticatedRequest).user.id;
    const invoice = await this.invoiceService.update(id, dto, userId);
    return ApiResponse.success(invoice);
  }

  /**
   * 触发请求书状态流转并返回最新结果。
   *
   * @param id - 请求书主键 ID
   * @param dto - 目标状态入参
   * @param req - 当前登录请求，用于提取操作人 ID
   * @returns 标准成功响应体，包含流转后的请求书详情
   */
  @Patch(':id/status')
  @Permissions(PermissionCodes.FINANCE_EDIT)
  @AuditAction({
    action: AuditActionType.STATUS_CHANGE,
    targetType: AuditTargetType.INVOICE,
  })
  @ApiOperation({ summary: '請求書ステータス変更' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInvoiceStatusDto,
    @Req() req: Request,
  ) {
    const userId = (req as AuthenticatedRequest).user.id;
    const invoice = await this.invoiceService.updateStatus(
      id,
      dto.status,
      userId,
    );
    return ApiResponse.success(invoice);
  }

  /**
   * 作废指定请求书并记录作废原因。
   *
   * @param id - 请求书主键 ID
   * @param dto - 作废原因入参
   * @param req - 当前登录请求，用于提取操作人 ID
   * @returns 标准成功响应体，包含作废后的请求书详情
   */
  @Patch(':id/void')
  @Permissions(PermissionCodes.FINANCE_VOID)
  @Idempotent()
  @AuditAction({
    action: AuditActionType.VOID,
    targetType: AuditTargetType.INVOICE,
  })
  @ApiOperation({ summary: '請求書無効化（作廃）' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiHeader({
    name: 'x-idempotency-key',
    required: false,
    description: '冪等キー',
  })
  async voidInvoice(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VoidInvoiceDto,
    @Req() req: Request,
  ) {
    const userId = (req as AuthenticatedRequest).user.id;
    const invoice = await this.invoiceService.voidInvoice(id, dto, userId);
    return ApiResponse.success(invoice);
  }

  /**
   * 返回指定请求书当前允许的状态迁移列表。
   *
   * @param id - 请求书主键 ID
   * @returns 标准成功响应体，包含可迁移到的状态数组
   */
  @Get(':id/transitions')
  @Permissions(PermissionCodes.FINANCE_DETAIL)
  @ApiOperation({ summary: '請求書の遷移可能なステータス一覧' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async getTransitions(@Param('id', ParseUUIDPipe) id: string) {
    const invoice = await this.invoiceService.findOne(id);
    return ApiResponse.success(
      this.invoiceService.getAvailableTransitions(invoice.status),
    );
  }

  /**
   * 软删除下书き状态的请求书。
   *
   * @param id - 请求书主键 ID
   * @returns 空响应体，依赖全局响应拦截器包装成功结果
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Permissions(PermissionCodes.FINANCE_DELETE)
  @AuditAction({
    action: AuditActionType.DELETE,
    targetType: AuditTargetType.INVOICE,
  })
  @ApiOperation({ summary: '請求書削除（論理削除・下書きのみ）' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.invoiceService.remove(id);
    return null;
  }

  /**
   * 从逻辑删除状态恢复请求书。
   *
   * @param id - 请求书主键 ID
   * @returns 标准成功响应体，包含恢复后的请求书详情
   */
  @Patch(':id/restore')
  @Permissions(PermissionCodes.FINANCE_EDIT)
  @AuditAction({
    action: AuditActionType.RESTORE,
    targetType: AuditTargetType.INVOICE,
  })
  @ApiOperation({ summary: '請求書復元（論理削除からの復元）' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async restore(@Param('id', ParseUUIDPipe) id: string) {
    const invoice = await this.invoiceService.restore(id);
    return ApiResponse.success(invoice);
  }
}
