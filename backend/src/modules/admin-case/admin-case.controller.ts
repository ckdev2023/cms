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
import { AdminCaseService } from './admin-case.service';
import {
  CreateAdminCaseDocumentDto,
  CreateAdminCaseDto,
  CreateInterviewDto,
  QueryAdminCaseDto,
  QueryInterviewDto,
  UpdateAdminCaseDocumentDto,
  UpdateAdminCaseDto,
  UpdateAdminCaseStatusDto,
  UpdateInterviewDto,
} from './dto';

/**
 * 提供行政案件模块的 REST 接口入口。
 *
 * 控制器仅负责权限装饰器、请求参数解析和统一响应包装，
 * 具体业务规则下沉到 `AdminCaseService` 处理。
 */
@ApiTags('行政書士')
@Controller('admin-cases')
@ApiBearerAuth()
export class AdminCaseController {
  constructor(private readonly adminCaseService: AdminCaseService) {}

  /**
   * 创建新的行政案件。
   *
   * @param dto - 案件创建请求体
   * @param req - 当前登录请求，用于提取操作人 ID
   * @returns 新创建的案件详情
   */
  @Post()
  @Permissions(PermissionCodes.ADMIN_CASE_CREATE)
  @AuditAction({
    action: AuditActionType.CREATE,
    targetType: AuditTargetType.ADMIN_CASE,
  })
  @ApiOperation({ summary: '案件新規作成' })
  async create(@Body() dto: CreateAdminCaseDto, @Req() req: Request) {
    const userId = this.getRequestUserId(req);
    return this.adminCaseService.create(dto, userId);
  }

  /**
   * 分页查询行政案件列表，并封装为统一分页响应体。
   *
   * @param query - 列表页查询参数
   * @returns 包含案件列表与分页元信息的标准响应
   */
  @Get()
  @Permissions(PermissionCodes.ADMIN_CASE_LIST)
  @ApiOperation({ summary: '案件一覧取得' })
  async findAll(@Query() query: QueryAdminCaseDto) {
    const result = await this.adminCaseService.findAll(query);
    return ApiResponse.paginated(
      result.items,
      result.total,
      result.page,
      result.pageSize,
    );
  }

  /**
   * 查询单个行政案件详情。
   *
   * @param id - 案件 ID
   * @returns 对应案件详情
   */
  @Get(':id')
  @Permissions(PermissionCodes.ADMIN_CASE_DETAIL)
  @ApiOperation({ summary: '案件詳細取得' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminCaseService.findOne(id);
  }

  /**
   * 更新行政案件的基础信息。
   *
   * @param id - 案件 ID
   * @param dto - 允许局部更新的案件字段
   * @param req - 当前登录请求，用于提取操作人 ID
   * @returns 更新后的案件详情
   */
  @Put(':id')
  @Permissions(PermissionCodes.ADMIN_CASE_EDIT)
  @AuditAction({
    action: AuditActionType.UPDATE,
    targetType: AuditTargetType.ADMIN_CASE,
  })
  @ApiOperation({ summary: '案件情報更新' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminCaseDto,
    @Req() req: Request,
  ) {
    const userId = this.getRequestUserId(req);
    return this.adminCaseService.update(id, dto, userId);
  }

  /**
   * 变更行政案件状态。
   *
   * @param id - 案件 ID
   * @param dto - 目标状态请求体
   * @param req - 当前登录请求，用于提取操作人 ID
   * @returns 完成状态变更后的案件详情
   */
  @Patch(':id/status')
  @Permissions(PermissionCodes.ADMIN_CASE_EDIT)
  @AuditAction({
    action: AuditActionType.STATUS_CHANGE,
    targetType: AuditTargetType.ADMIN_CASE,
  })
  @ApiOperation({ summary: '案件ステータス変更' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminCaseStatusDto,
    @Req() req: Request,
  ) {
    const userId = this.getRequestUserId(req);
    return this.adminCaseService.updateStatus(id, dto.status, userId);
  }

  /**
   * 逻辑删除指定行政案件。
   *
   * @param id - 案件 ID
   * @returns 空响应体
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Permissions(PermissionCodes.ADMIN_CASE_DELETE)
  @AuditAction({
    action: AuditActionType.DELETE,
    targetType: AuditTargetType.ADMIN_CASE,
  })
  @ApiOperation({ summary: '案件削除（論理削除）' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.adminCaseService.remove(id);
    return null;
  }

  /**
   * 恢复已被逻辑删除的行政案件。
   *
   * @param id - 案件 ID
   * @returns 恢复后的案件详情
   */
  @Patch(':id/restore')
  @Permissions(PermissionCodes.ADMIN_CASE_EDIT)
  @AuditAction({
    action: AuditActionType.RESTORE,
    targetType: AuditTargetType.ADMIN_CASE,
  })
  @ApiOperation({ summary: '案件復元（論理削除からの復元）' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminCaseService.restore(id);
  }

  /**
   * 查询当前案件可切换的目标状态列表。
   *
   * @param id - 案件 ID
   * @returns 允许的状态流转集合
   */
  @Get(':id/transitions')
  @Permissions(PermissionCodes.ADMIN_CASE_DETAIL)
  @ApiOperation({ summary: '案件の遷移可能なステータス一覧' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async getTransitions(@Param('id', ParseUUIDPipe) id: string) {
    const adminCase = await this.adminCaseService.findOne(id);
    return this.adminCaseService.getAvailableTransitions(adminCase.status);
  }

  /**
   * 为指定案件新增面谈记录。
   *
   * @param caseId - 案件 ID
   * @param dto - 面谈记录创建请求体
   * @param req - 当前登录请求，用于提取操作人 ID
   * @returns 新建的面谈记录详情
   */
  @Post(':caseId/interviews')
  @Permissions(PermissionCodes.ADMIN_CASE_EDIT)
  @ApiOperation({ summary: '面談記録作成' })
  @ApiParam({ name: 'caseId', type: 'string', format: 'uuid' })
  async createInterview(
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Body() dto: CreateInterviewDto,
    @Req() req: Request,
  ) {
    const userId = this.getRequestUserId(req);
    return this.adminCaseService.createInterview(caseId, dto, userId);
  }

  /**
   * 分页查询指定案件下的面谈记录。
   *
   * @param caseId - 案件 ID
   * @param query - 面谈记录查询参数
   * @returns 包含面谈记录和分页元信息的标准响应
   */
  @Get(':caseId/interviews')
  @Permissions(PermissionCodes.ADMIN_CASE_DETAIL)
  @ApiOperation({ summary: '面談記録一覧取得' })
  @ApiParam({ name: 'caseId', type: 'string', format: 'uuid' })
  async findInterviews(
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Query() query: QueryInterviewDto,
  ) {
    const result = await this.adminCaseService.findInterviews(caseId, query);
    return ApiResponse.paginated(
      result.items,
      result.total,
      result.page,
      result.pageSize,
    );
  }

  /**
   * 更新指定面谈记录。
   *
   * @param interviewId - 面谈记录 ID
   * @param dto - 面谈记录更新请求体
   * @param req - 当前登录请求，用于提取操作人 ID
   * @returns 更新后的面谈记录详情
   */
  @Put(':caseId/interviews/:interviewId')
  @Permissions(PermissionCodes.ADMIN_CASE_EDIT)
  @ApiOperation({ summary: '面談記録更新' })
  @ApiParam({ name: 'caseId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'interviewId', type: 'string', format: 'uuid' })
  async updateInterview(
    @Param('interviewId', ParseUUIDPipe) interviewId: string,
    @Body() dto: UpdateInterviewDto,
    @Req() req: Request,
  ) {
    const userId = this.getRequestUserId(req);
    return this.adminCaseService.updateInterview(interviewId, dto, userId);
  }

  /**
   * 逻辑删除指定面谈记录。
   *
   * @param interviewId - 面谈记录 ID
   * @returns 空响应体
   */
  @Delete(':caseId/interviews/:interviewId')
  @HttpCode(HttpStatus.OK)
  @Permissions(PermissionCodes.ADMIN_CASE_EDIT)
  @ApiOperation({ summary: '面談記録削除' })
  @ApiParam({ name: 'caseId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'interviewId', type: 'string', format: 'uuid' })
  async removeInterview(
    @Param('interviewId', ParseUUIDPipe) interviewId: string,
  ) {
    await this.adminCaseService.removeInterview(interviewId);
    return null;
  }

  /**
   * 查询指定案件已绑定的资料列表。
   *
   * @param caseId - 案件 ID
   * @returns 资料 DTO 列表
   */
  @Get(':caseId/documents')
  @Permissions(PermissionCodes.ADMIN_CASE_DETAIL)
  @ApiOperation({ summary: '案件書類一覧取得' })
  @ApiParam({ name: 'caseId', type: 'string', format: 'uuid' })
  async findDocuments(@Param('caseId', ParseUUIDPipe) caseId: string) {
    const docs = await this.adminCaseService.findDocuments(caseId);
    return docs.map((d) => this.adminCaseService.toDocumentDto(d));
  }

  /**
   * 为指定案件新增资料记录。
   *
   * @param caseId - 案件 ID
   * @param dto - 资料创建请求体
   * @returns 新建后的资料 DTO
   */
  @Post(':caseId/documents')
  @Permissions(PermissionCodes.ADMIN_CASE_EDIT)
  @ApiOperation({ summary: '案件書類追加' })
  @ApiParam({ name: 'caseId', type: 'string', format: 'uuid' })
  async createDocument(
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Body() dto: CreateAdminCaseDocumentDto,
  ) {
    const doc = await this.adminCaseService.createDocument(caseId, dto);
    return this.adminCaseService.toDocumentDto(doc);
  }

  /**
   * 更新指定案件资料的类型和备注。
   *
   * @param docId - 资料记录 ID
   * @param dto - 资料更新请求体
   * @returns 更新后的资料 DTO
   */
  @Put(':caseId/documents/:docId')
  @Permissions(PermissionCodes.ADMIN_CASE_EDIT)
  @ApiOperation({ summary: '案件書類更新' })
  @ApiParam({ name: 'caseId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'docId', type: 'string', format: 'uuid' })
  async updateDocument(
    @Param('docId', ParseUUIDPipe) docId: string,
    @Body() dto: UpdateAdminCaseDocumentDto,
  ) {
    const doc = await this.adminCaseService.updateDocument(docId, dto);
    return this.adminCaseService.toDocumentDto(doc);
  }

  /**
   * 删除指定案件资料记录。
   *
   * @param docId - 资料记录 ID
   * @returns 空响应体
   */
  @Delete(':caseId/documents/:docId')
  @HttpCode(HttpStatus.OK)
  @Permissions(PermissionCodes.ADMIN_CASE_EDIT)
  @ApiOperation({ summary: '案件書類削除' })
  @ApiParam({ name: 'caseId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'docId', type: 'string', format: 'uuid' })
  async removeDocument(@Param('docId', ParseUUIDPipe) docId: string) {
    await this.adminCaseService.removeDocument(docId);
    return null;
  }

  /**
   * 从认证请求中提取当前操作人 ID。
   *
   * @param req - 已通过认证守卫的请求对象
   * @returns 当前登录用户的主键 ID
   */
  private getRequestUserId(req: Request): string {
    return (req.user as { id: string }).id;
  }
}
