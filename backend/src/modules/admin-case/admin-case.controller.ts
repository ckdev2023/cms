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
import { AdminCaseService } from './admin-case.service'
import {
  CreateAdminCaseDto,
  UpdateAdminCaseDto,
  QueryAdminCaseDto,
  UpdateAdminCaseStatusDto,
  CreateInterviewDto,
  UpdateInterviewDto,
  QueryInterviewDto,
  CreateAdminCaseDocumentDto,
  UpdateAdminCaseDocumentDto,
} from './dto'
import { Permissions } from '../auth/decorators'
import { PermissionCodes } from '../../common/constants/permission-codes'
import { ApiResponse } from '../../common/helpers/api-response.helper'
import { AuditAction } from '../log/decorators'
import { AuditActionType, AuditTargetType } from '../../common/constants/enums'

@ApiTags('行政書士')
@Controller('admin-cases')
@ApiBearerAuth()
export class AdminCaseController {
  constructor(private readonly adminCaseService: AdminCaseService) {}

  // ── Cases ─────────────────────────────────────────────

  @Post()
  @Permissions(PermissionCodes.ADMIN_CASE_CREATE)
  @AuditAction({ action: AuditActionType.CREATE, targetType: AuditTargetType.ADMIN_CASE })
  @ApiOperation({ summary: '案件新規作成' })
  async create(@Body() dto: CreateAdminCaseDto, @Req() req: Request) {
    const userId = (req.user as { id: string }).id
    return this.adminCaseService.create(dto, userId)
  }

  @Get()
  @Permissions(PermissionCodes.ADMIN_CASE_LIST)
  @ApiOperation({ summary: '案件一覧取得' })
  async findAll(@Query() query: QueryAdminCaseDto) {
    const result = await this.adminCaseService.findAll(query)
    return ApiResponse.paginated(
      result.items,
      result.total,
      result.page,
      result.pageSize,
    )
  }

  @Get(':id')
  @Permissions(PermissionCodes.ADMIN_CASE_DETAIL)
  @ApiOperation({ summary: '案件詳細取得' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminCaseService.findOne(id)
  }

  @Put(':id')
  @Permissions(PermissionCodes.ADMIN_CASE_EDIT)
  @AuditAction({ action: AuditActionType.UPDATE, targetType: AuditTargetType.ADMIN_CASE })
  @ApiOperation({ summary: '案件情報更新' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminCaseDto,
    @Req() req: Request,
  ) {
    const userId = (req.user as { id: string }).id
    return this.adminCaseService.update(id, dto, userId)
  }

  @Patch(':id/status')
  @Permissions(PermissionCodes.ADMIN_CASE_EDIT)
  @AuditAction({ action: AuditActionType.STATUS_CHANGE, targetType: AuditTargetType.ADMIN_CASE })
  @ApiOperation({ summary: '案件ステータス変更' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminCaseStatusDto,
    @Req() req: Request,
  ) {
    const userId = (req.user as { id: string }).id
    return this.adminCaseService.updateStatus(id, dto.status, userId)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Permissions(PermissionCodes.ADMIN_CASE_DELETE)
  @AuditAction({ action: AuditActionType.DELETE, targetType: AuditTargetType.ADMIN_CASE })
  @ApiOperation({ summary: '案件削除（論理削除）' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.adminCaseService.remove(id)
    return null
  }

  @Patch(':id/restore')
  @Permissions(PermissionCodes.ADMIN_CASE_EDIT)
  @AuditAction({ action: AuditActionType.RESTORE, targetType: AuditTargetType.ADMIN_CASE })
  @ApiOperation({ summary: '案件復元（論理削除からの復元）' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminCaseService.restore(id)
  }

  @Get(':id/transitions')
  @Permissions(PermissionCodes.ADMIN_CASE_DETAIL)
  @ApiOperation({ summary: '案件の遷移可能なステータス一覧' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async getTransitions(@Param('id', ParseUUIDPipe) id: string) {
    const adminCase = await this.adminCaseService.findOne(id)
    return this.adminCaseService.getAvailableTransitions(adminCase.status)
  }

  // ── Interviews ────────────────────────────────────────

  @Post(':caseId/interviews')
  @Permissions(PermissionCodes.ADMIN_CASE_EDIT)
  @ApiOperation({ summary: '面談記録作成' })
  @ApiParam({ name: 'caseId', type: 'string', format: 'uuid' })
  async createInterview(
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Body() dto: CreateInterviewDto,
    @Req() req: Request,
  ) {
    const userId = (req.user as { id: string }).id
    return this.adminCaseService.createInterview(caseId, dto, userId)
  }

  @Get(':caseId/interviews')
  @Permissions(PermissionCodes.ADMIN_CASE_DETAIL)
  @ApiOperation({ summary: '面談記録一覧取得' })
  @ApiParam({ name: 'caseId', type: 'string', format: 'uuid' })
  async findInterviews(
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Query() query: QueryInterviewDto,
  ) {
    const result = await this.adminCaseService.findInterviews(caseId, query)
    return ApiResponse.paginated(
      result.items,
      result.total,
      result.page,
      result.pageSize,
    )
  }

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
    const userId = (req.user as { id: string }).id
    return this.adminCaseService.updateInterview(interviewId, dto, userId)
  }

  @Delete(':caseId/interviews/:interviewId')
  @HttpCode(HttpStatus.OK)
  @Permissions(PermissionCodes.ADMIN_CASE_EDIT)
  @ApiOperation({ summary: '面談記録削除' })
  @ApiParam({ name: 'caseId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'interviewId', type: 'string', format: 'uuid' })
  async removeInterview(
    @Param('interviewId', ParseUUIDPipe) interviewId: string,
  ) {
    await this.adminCaseService.removeInterview(interviewId)
    return null
  }

  // ── Documents ──────────────────────────────────────────

  @Get(':caseId/documents')
  @Permissions(PermissionCodes.ADMIN_CASE_DETAIL)
  @ApiOperation({ summary: '案件書類一覧取得' })
  @ApiParam({ name: 'caseId', type: 'string', format: 'uuid' })
  async findDocuments(@Param('caseId', ParseUUIDPipe) caseId: string) {
    const docs = await this.adminCaseService.findDocuments(caseId)
    return docs.map((d) => this.adminCaseService.toDocumentDto(d))
  }

  @Post(':caseId/documents')
  @Permissions(PermissionCodes.ADMIN_CASE_EDIT)
  @ApiOperation({ summary: '案件書類追加' })
  @ApiParam({ name: 'caseId', type: 'string', format: 'uuid' })
  async createDocument(
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Body() dto: CreateAdminCaseDocumentDto,
  ) {
    const doc = await this.adminCaseService.createDocument(caseId, dto)
    return this.adminCaseService.toDocumentDto(doc)
  }

  @Put(':caseId/documents/:docId')
  @Permissions(PermissionCodes.ADMIN_CASE_EDIT)
  @ApiOperation({ summary: '案件書類更新' })
  @ApiParam({ name: 'caseId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'docId', type: 'string', format: 'uuid' })
  async updateDocument(
    @Param('docId', ParseUUIDPipe) docId: string,
    @Body() dto: UpdateAdminCaseDocumentDto,
  ) {
    const doc = await this.adminCaseService.updateDocument(docId, dto)
    return this.adminCaseService.toDocumentDto(doc)
  }

  @Delete(':caseId/documents/:docId')
  @HttpCode(HttpStatus.OK)
  @Permissions(PermissionCodes.ADMIN_CASE_EDIT)
  @ApiOperation({ summary: '案件書類削除' })
  @ApiParam({ name: 'caseId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'docId', type: 'string', format: 'uuid' })
  async removeDocument(@Param('docId', ParseUUIDPipe) docId: string) {
    await this.adminCaseService.removeDocument(docId)
    return null
  }
}
