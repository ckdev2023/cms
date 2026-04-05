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
  UseGuards,
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
import { VisaCaseDataScopeQueryGuard } from '../visa-case/guards/visa-case-data-scope-query.guard';
import { CustomerService } from './customer.service';
import { CreateCustomerDto, QueryCustomerDto, UpdateCustomerDto } from './dto';

type AuthenticatedRequest = Request & { user: { id: string } };

@ApiTags('顧客')
@Controller('customers')
@ApiBearerAuth()
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  /**
   * 创建客户主档并按登录用户写入创建审计字段。
   *
   * @param dto - 包含客户基础信息及附属资料的创建请求体
   * @param req - 携带当前登录用户 ID 的认证请求对象
   * @returns 新建完成并加载关联信息的客户详情
   */
  @Post()
  @Permissions(PermissionCodes.CUSTOMER_CREATE)
  @AuditAction({
    action: AuditActionType.CREATE,
    targetType: AuditTargetType.CUSTOMER,
  })
  @ApiOperation({ summary: '顧客新規作成' })
  async create(
    @Body() dto: CreateCustomerDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.customerService.create(dto, req.user.id);
  }

  /**
   * 按筛选条件分页读取客户列表。
   *
   * @param query - 包含分页、关键字、状态与排序条件的查询参数
   * @param req - 携带当前登录用户 ID 的认证请求对象
   * @returns 符合统一分页结构的客户列表响应体
   */
  @Get()
  @UseGuards(VisaCaseDataScopeQueryGuard)
  @Permissions(PermissionCodes.CUSTOMER_LIST)
  @ApiOperation({ summary: '顧客一覧取得' })
  async findAll(
    @Query() query: QueryCustomerDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = await this.customerService.findAll(query, req.user.id);
    return ApiResponse.paginated(
      result.items,
      result.total,
      result.page,
      result.pageSize,
    );
  }

  /**
   * 读取单个客户的完整详情及关联资料。
   *
   * @param id - 客户主键 ID
   * @param req - 携带当前登录用户 ID 的认证请求对象（用于附加主展示签证案件摘要）
   * @returns 指定客户的详情实体及只读 `listPrimaryVisaCase` / `listPrimaryVisaCaseSource` / `primaryCustomerIdForListFallback` 字段
   */
  @Get(':id')
  @Permissions(PermissionCodes.CUSTOMER_DETAIL)
  @ApiOperation({ summary: '顧客詳細取得' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.customerService.findOneWithListPrimaryVisaCase(id, req.user.id);
  }

  /**
   * 更新客户基础信息及附属公司/个人资料。
   *
   * @param id - 客户主键 ID
   * @param dto - 包含可选更新字段的请求体
   * @param req - 携带当前登录用户 ID 的认证请求对象
   * @returns 更新后的客户详情
   */
  @Put(':id')
  @Permissions(PermissionCodes.CUSTOMER_EDIT)
  @AuditAction({
    action: AuditActionType.UPDATE,
    targetType: AuditTargetType.CUSTOMER,
  })
  @ApiOperation({ summary: '顧客情報更新' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.customerService.update(id, dto, req.user.id);
  }

  /**
   * 对客户记录执行逻辑删除。
   *
   * @param id - 客户主键 ID
   * @returns 空响应体，表示逻辑删除已完成
   */
  @Delete(':id')
  @Permissions(PermissionCodes.CUSTOMER_DELETE)
  @AuditAction({
    action: AuditActionType.DELETE,
    targetType: AuditTargetType.CUSTOMER,
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '顧客削除（論理削除）' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.customerService.remove(id);
    return null;
  }

  /**
   * 从逻辑删除状态恢复指定客户记录。
   *
   * @param id - 客户主键 ID
   * @returns 恢复后的客户详情
   */
  @Patch(':id/restore')
  @Permissions(PermissionCodes.CUSTOMER_EDIT)
  @AuditAction({
    action: AuditActionType.RESTORE,
    targetType: AuditTargetType.CUSTOMER,
  })
  @ApiOperation({ summary: '顧客復元（論理削除からの復元）' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.customerService.restore(id);
  }
}
