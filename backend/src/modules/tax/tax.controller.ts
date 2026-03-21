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
import { TaxService } from './tax.service'
import {
  CreateTaxContractDto,
  UpdateTaxContractDto,
  QueryTaxContractDto,
  UpdateTaxContractStatusDto,
  CreateTaxPeriodDto,
  UpdateTaxPeriodDto,
  QueryTaxPeriodDto,
  UpdatePeriodStatusDto,
  GeneratePeriodsDto,
  CreateTaxDocumentDto,
  UpdateTaxDocumentDto,
  CreateTaxWorkItemDto,
  UpdateTaxWorkItemDto,
} from './dto'
import { Permissions } from '../auth/decorators'
import { PermissionCodes } from '../../common/constants/permission-codes'
import { ApiResponse } from '../../common/helpers/api-response.helper'
import { AuditAction } from '../log/decorators'
import { AuditActionType, AuditTargetType } from '../../common/constants/enums'

@ApiTags('税理士')
@Controller('tax-contracts')
@ApiBearerAuth()
export class TaxController {
  constructor(private readonly taxService: TaxService) {}

  // ── Contracts ──────────────────────────────────────────

  @Post()
  @Permissions(PermissionCodes.TAX_CREATE)
  @AuditAction({ action: AuditActionType.CREATE, targetType: AuditTargetType.TAX_CONTRACT })
  @ApiOperation({ summary: '税務契約新規作成' })
  async create(@Body() dto: CreateTaxContractDto, @Req() req: Request) {
    const userId = (req.user as { id: string }).id
    return this.taxService.create(dto, userId)
  }

  @Get()
  @Permissions(PermissionCodes.TAX_LIST)
  @ApiOperation({ summary: '税務契約一覧取得' })
  async findAll(@Query() query: QueryTaxContractDto) {
    const result = await this.taxService.findAll(query)
    return ApiResponse.paginated(
      result.items,
      result.total,
      result.page,
      result.pageSize,
    )
  }

  @Get(':id')
  @Permissions(PermissionCodes.TAX_DETAIL)
  @ApiOperation({ summary: '税務契約詳細取得' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.taxService.findOne(id)
  }

  @Put(':id')
  @Permissions(PermissionCodes.TAX_EDIT)
  @AuditAction({ action: AuditActionType.UPDATE, targetType: AuditTargetType.TAX_CONTRACT })
  @ApiOperation({ summary: '税務契約情報更新' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaxContractDto,
    @Req() req: Request,
  ) {
    const userId = (req.user as { id: string }).id
    return this.taxService.update(id, dto, userId)
  }

  @Patch(':id/status')
  @Permissions(PermissionCodes.TAX_EDIT)
  @AuditAction({ action: AuditActionType.STATUS_CHANGE, targetType: AuditTargetType.TAX_CONTRACT })
  @ApiOperation({ summary: '税務契約ステータス変更' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaxContractStatusDto,
    @Req() req: Request,
  ) {
    const userId = (req.user as { id: string }).id
    return this.taxService.updateStatus(id, dto.contractStatus, userId)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Permissions(PermissionCodes.TAX_DELETE)
  @AuditAction({ action: AuditActionType.DELETE, targetType: AuditTargetType.TAX_CONTRACT })
  @ApiOperation({ summary: '税務契約削除（論理削除）' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.taxService.remove(id)
    return null
  }

  @Patch(':id/restore')
  @Permissions(PermissionCodes.TAX_EDIT)
  @AuditAction({ action: AuditActionType.RESTORE, targetType: AuditTargetType.TAX_CONTRACT })
  @ApiOperation({ summary: '税務契約復元（論理削除からの復元）' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.taxService.restore(id)
  }

  @Get(':id/transitions')
  @Permissions(PermissionCodes.TAX_DETAIL)
  @ApiOperation({ summary: '契約の遷移可能なステータス一覧' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async getTransitions(@Param('id', ParseUUIDPipe) id: string) {
    const contract = await this.taxService.findOne(id)
    return this.taxService.getAvailableTransitions(
      contract.contractStatus,
    )
  }

  // ── Periods ────────────────────────────────────────────

  @Post(':contractId/periods')
  @Permissions(PermissionCodes.TAX_EDIT)
  @ApiOperation({ summary: '月次期間作成' })
  @ApiParam({ name: 'contractId', type: 'string', format: 'uuid' })
  async createPeriod(
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @Body() dto: CreateTaxPeriodDto,
    @Req() req: Request,
  ) {
    const userId = (req.user as { id: string }).id
    const period = await this.taxService.createPeriod(
      contractId,
      dto,
      userId,
    )
    return this.taxService.toPeriodDetailDto(period)
  }

  @Post(':contractId/periods/generate')
  @Permissions(PermissionCodes.TAX_EDIT)
  @ApiOperation({ summary: '月次期間一括生成' })
  @ApiParam({ name: 'contractId', type: 'string', format: 'uuid' })
  async generatePeriods(
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @Body() dto: GeneratePeriodsDto,
    @Req() req: Request,
  ) {
    const userId = (req.user as { id: string }).id
    return this.taxService.generatePeriods(contractId, dto, userId)
  }

  @Get(':contractId/periods')
  @Permissions(PermissionCodes.TAX_DETAIL)
  @ApiOperation({ summary: '月次期間一覧取得' })
  @ApiParam({ name: 'contractId', type: 'string', format: 'uuid' })
  async findPeriods(
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @Query() query: QueryTaxPeriodDto,
  ) {
    const result = await this.taxService.findPeriods(contractId, query)
    return ApiResponse.paginated(
      result.items,
      result.total,
      result.page,
      result.pageSize,
    )
  }

  @Get(':contractId/periods/:periodId')
  @Permissions(PermissionCodes.TAX_DETAIL)
  @ApiOperation({ summary: '月次期間詳細取得' })
  @ApiParam({ name: 'contractId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'periodId', type: 'string', format: 'uuid' })
  async findOnePeriod(
    @Param('periodId', ParseUUIDPipe) periodId: string,
  ) {
    const period = await this.taxService.findOnePeriod(periodId)
    return this.taxService.toPeriodDetailDto(period)
  }

  @Put(':contractId/periods/:periodId')
  @Permissions(PermissionCodes.TAX_EDIT)
  @ApiOperation({ summary: '月次期間情報更新' })
  @ApiParam({ name: 'contractId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'periodId', type: 'string', format: 'uuid' })
  async updatePeriod(
    @Param('periodId', ParseUUIDPipe) periodId: string,
    @Body() dto: UpdateTaxPeriodDto,
    @Req() req: Request,
  ) {
    const userId = (req.user as { id: string }).id
    const period = await this.taxService.updatePeriod(
      periodId,
      dto,
      userId,
    )
    return this.taxService.toPeriodDetailDto(period)
  }

  @Patch(':contractId/periods/:periodId/status')
  @Permissions(PermissionCodes.TAX_EDIT)
  @ApiOperation({ summary: '月次ステータス変更' })
  @ApiParam({ name: 'contractId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'periodId', type: 'string', format: 'uuid' })
  async updatePeriodStatus(
    @Param('periodId', ParseUUIDPipe) periodId: string,
    @Body() dto: UpdatePeriodStatusDto,
    @Req() req: Request,
  ) {
    const userId = (req.user as { id: string }).id
    const period = await this.taxService.updatePeriodStatus(
      periodId,
      dto.monthlyStatus,
      userId,
    )
    return this.taxService.toPeriodDetailDto(period)
  }

  @Delete(':contractId/periods/:periodId')
  @HttpCode(HttpStatus.OK)
  @Permissions(PermissionCodes.TAX_DELETE)
  @ApiOperation({ summary: '月次期間削除' })
  @ApiParam({ name: 'contractId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'periodId', type: 'string', format: 'uuid' })
  async removePeriod(
    @Param('periodId', ParseUUIDPipe) periodId: string,
  ) {
    await this.taxService.removePeriod(periodId)
    return null
  }

  // ── Documents ──────────────────────────────────────────

  @Post(':contractId/periods/:periodId/documents')
  @Permissions(PermissionCodes.TAX_EDIT)
  @ApiOperation({ summary: '月次資料追加' })
  @ApiParam({ name: 'contractId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'periodId', type: 'string', format: 'uuid' })
  async createDocument(
    @Param('periodId', ParseUUIDPipe) periodId: string,
    @Body() dto: CreateTaxDocumentDto,
  ) {
    return this.taxService.createDocument(periodId, dto)
  }

  @Put(':contractId/periods/:periodId/documents/:docId')
  @Permissions(PermissionCodes.TAX_EDIT)
  @ApiOperation({ summary: '月次資料更新' })
  @ApiParam({ name: 'contractId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'periodId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'docId', type: 'string', format: 'uuid' })
  async updateDocument(
    @Param('docId', ParseUUIDPipe) docId: string,
    @Body() dto: UpdateTaxDocumentDto,
  ) {
    return this.taxService.updateDocument(docId, dto)
  }

  @Delete(':contractId/periods/:periodId/documents/:docId')
  @HttpCode(HttpStatus.OK)
  @Permissions(PermissionCodes.TAX_EDIT)
  @ApiOperation({ summary: '月次資料削除' })
  @ApiParam({ name: 'contractId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'periodId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'docId', type: 'string', format: 'uuid' })
  async removeDocument(
    @Param('docId', ParseUUIDPipe) docId: string,
  ) {
    await this.taxService.removeDocument(docId)
    return null
  }

  // ── Work Items ─────────────────────────────────────────

  @Post(':contractId/periods/:periodId/work-items')
  @Permissions(PermissionCodes.TAX_EDIT)
  @ApiOperation({ summary: '作業項目追加' })
  @ApiParam({ name: 'contractId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'periodId', type: 'string', format: 'uuid' })
  async createWorkItem(
    @Param('periodId', ParseUUIDPipe) periodId: string,
    @Body() dto: CreateTaxWorkItemDto,
  ) {
    return this.taxService.createWorkItem(periodId, dto)
  }

  @Put(':contractId/periods/:periodId/work-items/:itemId')
  @Permissions(PermissionCodes.TAX_EDIT)
  @ApiOperation({ summary: '作業項目更新' })
  @ApiParam({ name: 'contractId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'periodId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'itemId', type: 'string', format: 'uuid' })
  async updateWorkItem(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateTaxWorkItemDto,
    @Req() req: Request,
  ) {
    const userId = (req.user as { id: string }).id
    return this.taxService.updateWorkItem(itemId, dto, userId)
  }

  @Delete(':contractId/periods/:periodId/work-items/:itemId')
  @HttpCode(HttpStatus.OK)
  @Permissions(PermissionCodes.TAX_EDIT)
  @ApiOperation({ summary: '作業項目削除' })
  @ApiParam({ name: 'contractId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'periodId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'itemId', type: 'string', format: 'uuid' })
  async removeWorkItem(
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    await this.taxService.removeWorkItem(itemId)
    return null
  }
}
