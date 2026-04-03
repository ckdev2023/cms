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
import {
  CreateTaxContractDto,
  CreateTaxDocumentDto,
  CreateTaxPeriodDto,
  CreateTaxWorkItemDto,
  GeneratePeriodsDto,
  QueryTaxContractDto,
  QueryTaxPeriodDto,
  UpdatePeriodStatusDto,
  UpdateTaxContractDto,
  UpdateTaxContractStatusDto,
  UpdateTaxDocumentDto,
  UpdateTaxPeriodDto,
  UpdateTaxWorkItemDto,
} from './dto';
import { TaxService } from './tax.service';

/**
 * 暴露税务合同、月次期间、资料与作业项的后台管理接口。
 */
@ApiTags('税理士')
@Controller('tax-contracts')
@ApiBearerAuth()
export class TaxController {
  constructor(private readonly taxService: TaxService) {}

  /**
   * 从认证请求中提取当前操作人的用户 ID。
   *
   * @param req 已通过鉴权守卫的 HTTP 请求对象
   * @returns 当前登录用户的唯一标识
   */
  private getRequestUserId(req: Request): string {
    return (req.user as { id: string }).id;
  }

  // ── Contracts ──────────────────────────────────────────

  /**
   * 接收税务合同创建请求，并写入当前操作人的审计字段。
   *
   * @param dto - 税务合同创建参数，包含客户、合同名称与计费信息
   * @param req - 已完成鉴权的 HTTP 请求对象，用于提取当前登录用户 ID
   * @returns 新建完成且已补齐关联信息的税务合同实体
   */
  @Post()
  @Permissions(PermissionCodes.TAX_CREATE)
  @AuditAction({
    action: AuditActionType.CREATE,
    targetType: AuditTargetType.TAX_CONTRACT,
  })
  @ApiOperation({ summary: '税務契約新規作成' })
  async create(@Body() dto: CreateTaxContractDto, @Req() req: Request) {
    const userId = this.getRequestUserId(req);
    return this.taxService.create(dto, userId);
  }

  /**
   * 按查询条件返回税务合同分页结果。
   *
   * @param query - 税务合同列表的分页、筛选与排序参数
   * @returns 符合统一响应结构的税务合同分页数据
   */
  @Get()
  @Permissions(PermissionCodes.TAX_LIST)
  @ApiOperation({ summary: '税務契約一覧取得' })
  async findAll(@Query() query: QueryTaxContractDto) {
    const result = await this.taxService.findAll(query);
    return ApiResponse.paginated(
      result.items,
      result.total,
      result.page,
      result.pageSize,
    );
  }

  /**
   * 查询单个税务合同的详情信息。
   *
   * @param id - 税务合同主键 ID
   * @returns 包含客户、负责人和期间关联的税务合同实体
   */
  @Get(':id')
  @Permissions(PermissionCodes.TAX_DETAIL)
  @ApiOperation({ summary: '税務契約詳細取得' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.taxService.findOne(id);
  }

  /**
   * 更新税务合同的基础信息，并回写最后更新人。
   *
   * @param id - 税务合同主键 ID
   * @param dto - 税务合同更新参数，可按需局部提交
   * @param req - 已完成鉴权的 HTTP 请求对象，用于提取当前登录用户 ID
   * @returns 更新后的税务合同实体
   */
  @Put(':id')
  @Permissions(PermissionCodes.TAX_EDIT)
  @AuditAction({
    action: AuditActionType.UPDATE,
    targetType: AuditTargetType.TAX_CONTRACT,
  })
  @ApiOperation({ summary: '税務契約情報更新' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaxContractDto,
    @Req() req: Request,
  ) {
    const userId = this.getRequestUserId(req);
    return this.taxService.update(id, dto, userId);
  }

  /**
   * 变更税务合同状态，并记录当前操作人。
   *
   * @param id - 税务合同主键 ID
   * @param dto - 目标合同状态参数
   * @param req - 已完成鉴权的 HTTP 请求对象，用于提取当前登录用户 ID
   * @returns 状态变更后的税务合同实体
   */
  @Patch(':id/status')
  @Permissions(PermissionCodes.TAX_EDIT)
  @AuditAction({
    action: AuditActionType.STATUS_CHANGE,
    targetType: AuditTargetType.TAX_CONTRACT,
  })
  @ApiOperation({ summary: '税務契約ステータス変更' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaxContractStatusDto,
    @Req() req: Request,
  ) {
    const userId = this.getRequestUserId(req);
    return this.taxService.updateStatus(id, dto.contractStatus, userId);
  }

  /**
   * 软删除指定税务合同。
   *
   * @param id - 税务合同主键 ID
   * @returns 删除成功后返回空值，交由统一响应拦截器包装
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Permissions(PermissionCodes.TAX_DELETE)
  @AuditAction({
    action: AuditActionType.DELETE,
    targetType: AuditTargetType.TAX_CONTRACT,
  })
  @ApiOperation({ summary: '税務契約削除（論理削除）' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.taxService.remove(id);
    return null;
  }

  /**
   * 从逻辑删除状态恢复税务合同。
   *
   * @param id - 税务合同主键 ID
   * @returns 恢复后的税务合同实体
   */
  @Patch(':id/restore')
  @Permissions(PermissionCodes.TAX_EDIT)
  @AuditAction({
    action: AuditActionType.RESTORE,
    targetType: AuditTargetType.TAX_CONTRACT,
  })
  @ApiOperation({ summary: '税務契約復元（論理削除からの復元）' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.taxService.restore(id);
  }

  /**
   * 查询合同当前状态允许切换到的目标状态集合。
   *
   * @param id - 税务合同主键 ID
   * @returns 当前合同可执行的状态迁移列表
   */
  @Get(':id/transitions')
  @Permissions(PermissionCodes.TAX_DETAIL)
  @ApiOperation({ summary: '契約の遷移可能なステータス一覧' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async getTransitions(@Param('id', ParseUUIDPipe) id: string) {
    const contract = await this.taxService.findOne(id);
    return this.taxService.getAvailableTransitions(contract.contractStatus);
  }

  // ── Periods ────────────────────────────────────────────

  /**
   * 在指定税务合同下创建单个月次期间。
   *
   * @param contractId - 所属税务合同 ID
   * @param dto - 月次期间创建参数
   * @param req - 已完成鉴权的 HTTP 请求对象，用于提取当前登录用户 ID
   * @returns 展开资料与作业项明细后的月次期间详情 DTO
   */
  @Post(':contractId/periods')
  @Permissions(PermissionCodes.TAX_EDIT)
  @ApiOperation({ summary: '月次期間作成' })
  @ApiParam({ name: 'contractId', type: 'string', format: 'uuid' })
  async createPeriod(
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @Body() dto: CreateTaxPeriodDto,
    @Req() req: Request,
  ) {
    const userId = this.getRequestUserId(req);
    const period = await this.taxService.createPeriod(contractId, dto, userId);
    return this.taxService.toPeriodDetailDto(period);
  }

  /**
   * 按起止年月批量生成月次期间。
   *
   * @param contractId - 所属税务合同 ID
   * @param dto - 批量生成的年月区间与截止日参数
   * @param req - 已完成鉴权的 HTTP 请求对象，用于提取当前登录用户 ID
   * @returns 本次实际新建的月次期间实体列表
   */
  @Post(':contractId/periods/generate')
  @Permissions(PermissionCodes.TAX_EDIT)
  @ApiOperation({ summary: '月次期間一括生成' })
  @ApiParam({ name: 'contractId', type: 'string', format: 'uuid' })
  async generatePeriods(
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @Body() dto: GeneratePeriodsDto,
    @Req() req: Request,
  ) {
    const userId = this.getRequestUserId(req);
    return this.taxService.generatePeriods(contractId, dto, userId);
  }

  /**
   * 查询指定合同下的月次期间分页列表。
   *
   * @param contractId - 所属税务合同 ID
   * @param query - 月次期间的分页、筛选与排序参数
   * @returns 符合统一响应结构的月次期间分页数据
   */
  @Get(':contractId/periods')
  @Permissions(PermissionCodes.TAX_DETAIL)
  @ApiOperation({ summary: '月次期間一覧取得' })
  @ApiParam({ name: 'contractId', type: 'string', format: 'uuid' })
  async findPeriods(
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @Query() query: QueryTaxPeriodDto,
  ) {
    const result = await this.taxService.findPeriods(contractId, query);
    return ApiResponse.paginated(
      result.items,
      result.total,
      result.page,
      result.pageSize,
    );
  }

  /**
   * 查询单个月次期间的详情信息。
   *
   * @param periodId - 月次期间主键 ID
   * @returns 展开资料与作业项明细后的月次期间详情 DTO
   */
  @Get(':contractId/periods/:periodId')
  @Permissions(PermissionCodes.TAX_DETAIL)
  @ApiOperation({ summary: '月次期間詳細取得' })
  @ApiParam({ name: 'contractId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'periodId', type: 'string', format: 'uuid' })
  async findOnePeriod(@Param('periodId', ParseUUIDPipe) periodId: string) {
    const period = await this.taxService.findOnePeriod(periodId);
    return this.taxService.toPeriodDetailDto(period);
  }

  /**
   * 更新月次期间的年月、截止日或状态信息。
   *
   * @param periodId - 月次期间主键 ID
   * @param dto - 月次期间更新参数
   * @param req - 已完成鉴权的 HTTP 请求对象，用于提取当前登录用户 ID
   * @returns 更新后的月次期间详情 DTO
   */
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
    const userId = this.getRequestUserId(req);
    const period = await this.taxService.updatePeriod(periodId, dto, userId);
    return this.taxService.toPeriodDetailDto(period);
  }

  /**
   * 单独更新月次期间的执行状态。
   *
   * @param periodId - 月次期间主键 ID
   * @param dto - 目标月次状态参数
   * @param req - 已完成鉴权的 HTTP 请求对象，用于提取当前登录用户 ID
   * @returns 状态更新后的月次期间详情 DTO
   */
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
    const userId = this.getRequestUserId(req);
    const period = await this.taxService.updatePeriodStatus(
      periodId,
      dto.monthlyStatus,
      userId,
    );
    return this.taxService.toPeriodDetailDto(period);
  }

  /**
   * 删除指定月次期间及其子级资料、作业项记录。
   *
   * @param periodId - 月次期间主键 ID
   * @returns 删除成功后返回空值，交由统一响应拦截器包装
   */
  @Delete(':contractId/periods/:periodId')
  @HttpCode(HttpStatus.OK)
  @Permissions(PermissionCodes.TAX_DELETE)
  @ApiOperation({ summary: '月次期間削除' })
  @ApiParam({ name: 'contractId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'periodId', type: 'string', format: 'uuid' })
  async removePeriod(@Param('periodId', ParseUUIDPipe) periodId: string) {
    await this.taxService.removePeriod(periodId);
    return null;
  }

  // ── Documents ──────────────────────────────────────────

  /**
   * 为月次期间新增一条资料记录。
   *
   * @param periodId - 月次期间主键 ID
   * @param dto - 资料名称、附件与接收状态参数
   * @returns 新建后的月次资料实体
   */
  @Post(':contractId/periods/:periodId/documents')
  @Permissions(PermissionCodes.TAX_EDIT)
  @ApiOperation({ summary: '月次資料追加' })
  @ApiParam({ name: 'contractId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'periodId', type: 'string', format: 'uuid' })
  async createDocument(
    @Param('periodId', ParseUUIDPipe) periodId: string,
    @Body() dto: CreateTaxDocumentDto,
  ) {
    return this.taxService.createDocument(periodId, dto);
  }

  /**
   * 更新月次资料的名称、接收状态或附件关联。
   *
   * @param docId - 月次资料主键 ID
   * @param dto - 月次资料更新参数
   * @returns 更新后的月次资料实体
   */
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
    return this.taxService.updateDocument(docId, dto);
  }

  /**
   * 删除指定月次资料记录。
   *
   * @param docId - 月次资料主键 ID
   * @returns 删除成功后返回空值，交由统一响应拦截器包装
   */
  @Delete(':contractId/periods/:periodId/documents/:docId')
  @HttpCode(HttpStatus.OK)
  @Permissions(PermissionCodes.TAX_EDIT)
  @ApiOperation({ summary: '月次資料削除' })
  @ApiParam({ name: 'contractId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'periodId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'docId', type: 'string', format: 'uuid' })
  async removeDocument(@Param('docId', ParseUUIDPipe) docId: string) {
    await this.taxService.removeDocument(docId);
    return null;
  }

  // ── Work Items ─────────────────────────────────────────

  /**
   * 为月次期间新增一条作业项。
   *
   * @param periodId - 月次期间主键 ID
   * @param dto - 作业项名称、排序与完成状态参数
   * @returns 新建后的作业项实体
   */
  @Post(':contractId/periods/:periodId/work-items')
  @Permissions(PermissionCodes.TAX_EDIT)
  @ApiOperation({ summary: '作業項目追加' })
  @ApiParam({ name: 'contractId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'periodId', type: 'string', format: 'uuid' })
  async createWorkItem(
    @Param('periodId', ParseUUIDPipe) periodId: string,
    @Body() dto: CreateTaxWorkItemDto,
  ) {
    return this.taxService.createWorkItem(periodId, dto);
  }

  /**
   * 更新作业项内容，并在完成状态切换时记录操作人。
   *
   * @param itemId - 作业项主键 ID
   * @param dto - 作业项更新参数
   * @param req - 已完成鉴权的 HTTP 请求对象，用于提取当前登录用户 ID
   * @returns 更新后的作业项实体
   */
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
    const userId = this.getRequestUserId(req);
    return this.taxService.updateWorkItem(itemId, dto, userId);
  }

  /**
   * 删除指定作业项记录。
   *
   * @param itemId - 作业项主键 ID
   * @returns 删除成功后返回空值，交由统一响应拦截器包装
   */
  @Delete(':contractId/periods/:periodId/work-items/:itemId')
  @HttpCode(HttpStatus.OK)
  @Permissions(PermissionCodes.TAX_EDIT)
  @ApiOperation({ summary: '作業項目削除' })
  @ApiParam({ name: 'contractId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'periodId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'itemId', type: 'string', format: 'uuid' })
  async removeWorkItem(@Param('itemId', ParseUUIDPipe) itemId: string) {
    await this.taxService.removeWorkItem(itemId);
    return null;
  }
}
