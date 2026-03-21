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
} from '@nestjs/common'
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger'
import type { Request } from 'express'
import { CustomerService } from './customer.service'
import { CreateCustomerDto, UpdateCustomerDto, QueryCustomerDto } from './dto'
import { Permissions } from '../auth/decorators'
import { PermissionCodes } from '../../common/constants/permission-codes'
import { ApiResponse } from '../../common/helpers/api-response.helper'
import { AuditAction } from '../log/decorators'
import { AuditActionType, AuditTargetType } from '../../common/constants/enums'

@ApiTags('顧客')
@Controller('customers')
@ApiBearerAuth()
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Post()
  @Permissions(PermissionCodes.CUSTOMER_CREATE)
  @AuditAction({ action: AuditActionType.CREATE, targetType: AuditTargetType.CUSTOMER })
  @ApiOperation({ summary: '顧客新規作成' })
  async create(@Body() dto: CreateCustomerDto, @Req() req: Request) {
    const userId = (req.user as { id: string }).id
    const customer = await this.customerService.create(dto, userId)
    return customer
  }

  @Get()
  @Permissions(PermissionCodes.CUSTOMER_LIST)
  @ApiOperation({ summary: '顧客一覧取得' })
  async findAll(@Query() query: QueryCustomerDto) {
    const result = await this.customerService.findAll(query)
    return ApiResponse.paginated(
      result.items,
      result.total,
      result.page,
      result.pageSize,
    )
  }

  @Get(':id')
  @Permissions(PermissionCodes.CUSTOMER_DETAIL)
  @ApiOperation({ summary: '顧客詳細取得' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.customerService.findOne(id)
  }

  @Put(':id')
  @Permissions(PermissionCodes.CUSTOMER_EDIT)
  @AuditAction({ action: AuditActionType.UPDATE, targetType: AuditTargetType.CUSTOMER })
  @ApiOperation({ summary: '顧客情報更新' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
    @Req() req: Request,
  ) {
    const userId = (req.user as { id: string }).id
    return this.customerService.update(id, dto, userId)
  }

  @Delete(':id')
  @Permissions(PermissionCodes.CUSTOMER_DELETE)
  @AuditAction({ action: AuditActionType.DELETE, targetType: AuditTargetType.CUSTOMER })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '顧客削除（論理削除）' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.customerService.remove(id)
    return null
  }

  @Patch(':id/restore')
  @Permissions(PermissionCodes.CUSTOMER_EDIT)
  @AuditAction({ action: AuditActionType.RESTORE, targetType: AuditTargetType.CUSTOMER })
  @ApiOperation({ summary: '顧客復元（論理削除からの復元）' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.customerService.restore(id)
  }
}
