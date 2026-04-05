/* eslint-disable max-lines -- 聚合签证案件域多子资源 REST 路由，拆分会增加跨文件跳转成本 */
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
import { CreateCustomerFilePathDto } from './dto/create-customer-file-path.dto';
import { CreateMaterialTemplateDto } from './dto/create-material-template.dto';
import { CreateVisaCaseDto } from './dto/create-visa-case.dto';
import { CreateVisaCaseFamilyMemberDto } from './dto/create-visa-case-family-member.dto';
import { CreateVisaCaseLogDto } from './dto/create-visa-case-log.dto';
import { CreateVisaCaseMaterialItemDto } from './dto/create-visa-case-material-item.dto';
import { QueryCustomerFilePathDto } from './dto/query-customer-file-path.dto';
import { QueryGlobalVisaCaseListDto } from './dto/query-global-visa-case-list.dto';
import { QueryVisaCaseDto } from './dto/query-visa-case.dto';
import { QueryVisaCaseLogDto } from './dto/query-visa-case-log.dto';
import { QueryVisaCaseStatsDto } from './dto/query-visa-case-stats.dto';
import { QueryVisaReminderDto } from './dto/query-visa-reminder.dto';
import { QueryVisaWorkbenchDto } from './dto/query-visa-workbench.dto';
import { UpdateCustomerFilePathDto } from './dto/update-customer-file-path.dto';
import { UpdateMaterialTemplateDto } from './dto/update-material-template.dto';
import { UpdateVisaCaseDto } from './dto/update-visa-case.dto';
import { UpdateVisaCaseFamilyMemberDto } from './dto/update-visa-case-family-member.dto';
import { UpdateVisaCaseLogDto } from './dto/update-visa-case-log.dto';
import { UpdateVisaCaseMaterialItemDto } from './dto/update-visa-case-material-item.dto';
import { VisaCaseDataScopeQueryGuard } from './guards/visa-case-data-scope-query.guard';
import { VisaCaseService } from './visa-case.service';

type AuthenticatedRequest = Request & { user: { id: string } };

/**
 * 签证案件 REST 控制器，提供客户上下文建案与独立案件详情两组端点。
 *
 * - `/customers/:customerId/visa-cases` — 在客户上下文中列表与创建
 * - `/visa-cases/:id` — 案件详情与更新
 */
@ApiTags('ビザ案件')
@ApiBearerAuth()
@Controller()
export class VisaCaseController {
  constructor(private readonly visaCaseService: VisaCaseService) {}

  /**
   * 按四类提醒桶聚合返回签证案件提醒列表，支持按桶类型与负责人筛选。
   *
   * @param query - 提醒桶类型与负责人的可选筛选参数
   * @param req - 携带当前登录用户 ID 的认证请求对象
   * @returns 去重排序后的分页提醒列表
   */
  @Get('visa-reminders')
  @UseGuards(VisaCaseDataScopeQueryGuard)
  @Permissions(PermissionCodes.VISA_REMINDER_LIST)
  @ApiOperation({ summary: 'ビザリマインダー一覧取得' })
  async findVisaReminders(
    @Query() query: QueryVisaReminderDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = await this.visaCaseService.findVisaReminders(
      query,
      req.user.id,
    );
    return ApiResponse.paginated(
      result.items,
      result.total,
      result.page,
      result.pageSize,
    );
  }

  /**
   * 跨客户分页读取签证案件列表，支持多维度筛选与客户展示字段批量加载。
   *
   * @param query - 全局列表分页与筛选参数
   * @param req - 携带当前登录用户 ID 的认证请求对象
   * @returns 符合统一分页结构的案件列表响应体
   */
  @Get('visa-cases')
  @UseGuards(VisaCaseDataScopeQueryGuard)
  @Permissions(PermissionCodes.VISA_CASE_LIST)
  @ApiOperation({ summary: 'ビザ案件一覧取得（全顧客横断）' })
  async findAllGlobal(
    @Query() query: QueryGlobalVisaCaseListDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = await this.visaCaseService.findAllGlobal(query, req.user.id);
    return ApiResponse.paginated(
      result.items,
      result.total,
      result.page,
      result.pageSize,
    );
  }

  /**
   * 返回签证域只读 KPI 聚合，与提醒桶去重规则一致。
   *
   * @param query - 可选负责人筛选
   * @param req - 携带当前登录用户 ID 的认证请求对象
   * @returns 标准成功响应体包裹的统计载荷
   */
  @Get('visa-cases/stats')
  @UseGuards(VisaCaseDataScopeQueryGuard)
  @Permissions(PermissionCodes.VISA_CASE_LIST)
  @ApiOperation({ summary: 'ビザ案件ドメイン統計（読み取り専用）' })
  async getVisaDomainStats(
    @Query() query: QueryVisaCaseStatsDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.visaCaseService.getVisaDomainStats(
      query,
      req.user.id,
    );
    return ApiResponse.success(data);
  }

  /**
   * 返回工作台用只读聚合：域统计（同 `/visa-cases/stats`）+ 四分桶各 Top N 预览（同 `/visa-reminders` 规则）。
   * `visaReminder:list` 与 `visaCase:list` 命中其一即可。
   *
   * @param query - 可选负责人与每桶预览条数（`previewLimit`，0 仅统计）
   * @param req - 携带当前登录用户 ID 的认证请求对象
   * @returns 聚合载荷
   */
  @Get('workbench/visa')
  @UseGuards(VisaCaseDataScopeQueryGuard)
  @Permissions(
    PermissionCodes.VISA_REMINDER_LIST,
    PermissionCodes.VISA_CASE_LIST,
  )
  @ApiOperation({ summary: 'ビザ業務デスク集約（読み取り専用）' })
  async getVisaWorkbenchAggregate(
    @Query() query: QueryVisaWorkbenchDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.visaCaseService.getVisaWorkbenchAggregate(
      query,
      req.user.id,
    );
    return ApiResponse.success(data);
  }

  /**
   * 在指定客户上下文中创建最小签证案件。
   *
   * @param customerId - 路由中传入的客户主键 ID
   * @param dto - 案件创建请求体
   * @param req - 携带当前登录用户 ID 的认证请求对象
   * @returns 新创建且带关联信息的案件响应体
   */
  @Post('customers/:customerId/visa-cases')
  @Permissions(PermissionCodes.VISA_CASE_CREATE)
  @AuditAction({
    action: AuditActionType.CREATE,
    targetType: AuditTargetType.VISA_CASE,
  })
  @ApiOperation({ summary: 'ビザ案件新規作成（顧客コンテキスト）' })
  @ApiParam({ name: 'customerId', type: 'string', format: 'uuid' })
  async create(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: CreateVisaCaseDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.visaCaseService.create(customerId, dto, req.user.id);
  }

  /**
   * 分页读取指定客户名下的签证案件列表。
   *
   * @param customerId - 路由中传入的客户主键 ID
   * @param query - 案件分页与筛选查询参数
   * @param req - 携带当前登录用户 ID 的认证请求对象
   * @returns 符合统一分页结构的案件列表响应体
   */
  @Get('customers/:customerId/visa-cases')
  @UseGuards(VisaCaseDataScopeQueryGuard)
  @Permissions(PermissionCodes.VISA_CASE_LIST)
  @ApiOperation({ summary: 'ビザ案件一覧取得（顧客コンテキスト）' })
  @ApiParam({ name: 'customerId', type: 'string', format: 'uuid' })
  async findByCustomer(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Query() query: QueryVisaCaseDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = await this.visaCaseService.findByCustomer(
      customerId,
      query,
      req.user.id,
    );
    return ApiResponse.paginated(
      result.items,
      result.total,
      result.page,
      result.pageSize,
    );
  }

  /**
   * 读取单个签证案件详情。
   *
   * @param id - 签证案件主键 ID
   * @param req - 携带当前登录用户 ID 的认证请求对象
   * @returns 指定案件的详情响应体
   */
  @Get('visa-cases/:id')
  @Permissions(PermissionCodes.VISA_CASE_DETAIL)
  @ApiOperation({ summary: 'ビザ案件詳細取得' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.visaCaseService.findOne(id, req.user.id);
  }

  /**
   * 更新签证案件的可编辑字段。
   *
   * @param id - 签证案件主键 ID
   * @param dto - 案件更新请求体
   * @param req - 携带当前登录用户 ID 的认证请求对象
   * @returns 更新后的案件详情响应体
   */
  @Put('visa-cases/:id')
  @Permissions(PermissionCodes.VISA_CASE_EDIT)
  @AuditAction({
    action: AuditActionType.UPDATE,
    targetType: AuditTargetType.VISA_CASE,
  })
  @ApiOperation({ summary: 'ビザ案件更新' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVisaCaseDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.visaCaseService.update(id, dto, req.user.id);
  }

  /**
   * 查询指定签证案件下的全部家属成员。
   *
   * @param visaCaseId - 签证案件主键 ID
   * @param req - 携带当前登录用户 ID 的认证请求对象
   * @returns 家属成员列表响应体
   */
  @Get('visa-cases/:visaCaseId/family-members')
  @Permissions(PermissionCodes.VISA_CASE_DETAIL)
  @ApiOperation({ summary: 'ビザ案件家族メンバー一覧' })
  @ApiParam({ name: 'visaCaseId', type: 'string', format: 'uuid' })
  async listFamilyMembers(
    @Param('visaCaseId', ParseUUIDPipe) visaCaseId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.visaCaseService.listFamilyMembers(visaCaseId, req.user.id);
  }

  /**
   * 向指定签证案件挂载一名家属成员。
   *
   * @param visaCaseId - 签证案件主键 ID
   * @param dto - 家属成员创建请求体
   * @param req - 携带当前登录用户 ID 的认证请求对象
   * @returns 新挂载的家属成员响应体
   */
  @Post('visa-cases/:visaCaseId/family-members')
  @Permissions(PermissionCodes.VISA_CASE_EDIT)
  @AuditAction({
    action: AuditActionType.UPDATE,
    targetType: AuditTargetType.VISA_CASE,
  })
  @ApiOperation({ summary: 'ビザ案件家族メンバー追加' })
  @ApiParam({ name: 'visaCaseId', type: 'string', format: 'uuid' })
  async addFamilyMember(
    @Param('visaCaseId', ParseUUIDPipe) visaCaseId: string,
    @Body() dto: CreateVisaCaseFamilyMemberDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.visaCaseService.addFamilyMember(visaCaseId, dto, req.user.id);
  }

  /**
   * 更新指定家属成员的角色或主申请人标记。
   *
   * @param visaCaseId - 签证案件主键 ID
   * @param memberId - 家属成员记录 ID
   * @param dto - 家属成员更新请求体
   * @param req - 携带当前登录用户 ID 的认证请求对象
   * @returns 更新后的家属成员响应体
   */
  @Put('visa-cases/:visaCaseId/family-members/:memberId')
  @Permissions(PermissionCodes.VISA_CASE_EDIT)
  @AuditAction({
    action: AuditActionType.UPDATE,
    targetType: AuditTargetType.VISA_CASE,
  })
  @ApiOperation({ summary: 'ビザ案件家族メンバー更新' })
  @ApiParam({ name: 'visaCaseId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'memberId', type: 'string', format: 'uuid' })
  async updateFamilyMember(
    @Param('visaCaseId', ParseUUIDPipe) visaCaseId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: UpdateVisaCaseFamilyMemberDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.visaCaseService.updateFamilyMember(
      visaCaseId,
      memberId,
      dto,
      req.user.id,
    );
  }

  /**
   * 从签证案件中移除指定家属成员。
   *
   * @param visaCaseId - 签证案件主键 ID
   * @param memberId - 家属成员记录 ID
   * @param req - 携带当前登录用户 ID 的认证请求对象
   */
  @Delete('visa-cases/:visaCaseId/family-members/:memberId')
  @Permissions(PermissionCodes.VISA_CASE_EDIT)
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuditAction({
    action: AuditActionType.DELETE,
    targetType: AuditTargetType.VISA_CASE,
  })
  @ApiOperation({ summary: 'ビザ案件家族メンバー削除' })
  @ApiParam({ name: 'visaCaseId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'memberId', type: 'string', format: 'uuid' })
  async removeFamilyMember(
    @Param('visaCaseId', ParseUUIDPipe) visaCaseId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.visaCaseService.removeFamilyMember(
      visaCaseId,
      memberId,
      req.user.id,
    );
  }

  /**
   * 为指定签证案件创建一条日志记录。
   *
   * @param visaCaseId - 签证案件主键 ID
   * @param dto - 案件日志创建请求体
   * @param req - 携带当前登录用户 ID 的认证请求对象
   * @returns 新创建且带创建人信息的日志响应体
   */
  @Post('visa-cases/:visaCaseId/logs')
  @Permissions(PermissionCodes.VISA_CASE_LOG_CREATE)
  @AuditAction({
    action: AuditActionType.CREATE,
    targetType: AuditTargetType.VISA_CASE_LOG,
  })
  @ApiOperation({ summary: 'ビザ案件ログ新規作成' })
  @ApiParam({ name: 'visaCaseId', type: 'string', format: 'uuid' })
  async createLog(
    @Param('visaCaseId', ParseUUIDPipe) visaCaseId: string,
    @Body() dto: CreateVisaCaseLogDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.visaCaseService.createLog(visaCaseId, dto, req.user.id);
  }

  /**
   * 分页读取指定签证案件的日志列表。
   *
   * @param visaCaseId - 签证案件主键 ID
   * @param query - 日志分页与类型筛选查询参数
   * @param req - 携带当前登录用户 ID 的认证请求对象
   * @returns 符合统一分页结构的日志列表响应体
   */
  @Get('visa-cases/:visaCaseId/logs')
  @Permissions(PermissionCodes.VISA_CASE_DETAIL)
  @ApiOperation({ summary: 'ビザ案件ログ一覧取得' })
  @ApiParam({ name: 'visaCaseId', type: 'string', format: 'uuid' })
  async findLogs(
    @Param('visaCaseId', ParseUUIDPipe) visaCaseId: string,
    @Query() query: QueryVisaCaseLogDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = await this.visaCaseService.findLogs(
      visaCaseId,
      query,
      req.user.id,
    );
    return ApiResponse.paginated(
      result.items,
      result.total,
      result.page,
      result.pageSize,
    );
  }

  /**
   * 读取单条签证案件日志详情。
   *
   * @param visaCaseId - 签证案件主键 ID
   * @param logId - 日志主键 ID
   * @param req - 携带当前登录用户 ID 的认证请求对象
   * @returns 指定案件范围下的日志详情响应体
   */
  @Get('visa-cases/:visaCaseId/logs/:logId')
  @Permissions(PermissionCodes.VISA_CASE_DETAIL)
  @ApiOperation({ summary: 'ビザ案件ログ詳細取得' })
  @ApiParam({ name: 'visaCaseId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'logId', type: 'string', format: 'uuid' })
  async findOneLog(
    @Param('visaCaseId', ParseUUIDPipe) visaCaseId: string,
    @Param('logId', ParseUUIDPipe) logId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.visaCaseService.findOneLog(visaCaseId, logId, req.user.id);
  }

  /**
   * 更新指定签证案件日志的内容或结构化字段。
   *
   * @param visaCaseId - 签证案件主键 ID
   * @param logId - 日志主键 ID
   * @param dto - 日志更新请求体
   * @param req - 携带当前登录用户 ID 的认证请求对象
   * @returns 更新后的日志详情响应体
   */
  @Put('visa-cases/:visaCaseId/logs/:logId')
  @Permissions(PermissionCodes.VISA_CASE_LOG_EDIT)
  @AuditAction({
    action: AuditActionType.UPDATE,
    targetType: AuditTargetType.VISA_CASE_LOG,
  })
  @ApiOperation({ summary: 'ビザ案件ログ更新' })
  @ApiParam({ name: 'visaCaseId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'logId', type: 'string', format: 'uuid' })
  async updateLog(
    @Param('visaCaseId', ParseUUIDPipe) visaCaseId: string,
    @Param('logId', ParseUUIDPipe) logId: string,
    @Body() dto: UpdateVisaCaseLogDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.visaCaseService.updateLog(visaCaseId, logId, dto, req.user.id);
  }

  /**
   * 对指定签证案件日志执行逻辑删除。
   *
   * @param visaCaseId - 签证案件主键 ID
   * @param logId - 日志主键 ID
   * @param req - 携带当前登录用户 ID 的认证请求对象
   * @returns 空响应体，表示逻辑删除已完成
   */
  @Delete('visa-cases/:visaCaseId/logs/:logId')
  @Permissions(PermissionCodes.VISA_CASE_LOG_DELETE)
  @HttpCode(HttpStatus.OK)
  @AuditAction({
    action: AuditActionType.DELETE,
    targetType: AuditTargetType.VISA_CASE_LOG,
  })
  @ApiOperation({ summary: 'ビザ案件ログ削除（論理削除）' })
  @ApiParam({ name: 'visaCaseId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'logId', type: 'string', format: 'uuid' })
  async removeLog(
    @Param('visaCaseId', ParseUUIDPipe) visaCaseId: string,
    @Param('logId', ParseUUIDPipe) logId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.visaCaseService.removeLog(visaCaseId, logId, req.user.id);
    return null;
  }

  /**
   * 在指定客户上下文中创建一条资料路径台账记录。
   *
   * @param customerId - 路径归属的客户 ID
   * @param dto - 路径创建请求体
   * @param req - 携带当前登录用户 ID 的认证请求对象
   * @returns 新创建的路径响应体
   */
  @Post('customers/:customerId/file-paths')
  @Permissions(PermissionCodes.CUSTOMER_FILE_PATH_CREATE)
  @AuditAction({
    action: AuditActionType.CREATE,
    targetType: AuditTargetType.CUSTOMER_FILE_PATH,
  })
  @ApiOperation({ summary: '顧客資料パス新規作成' })
  @ApiParam({ name: 'customerId', type: 'string', format: 'uuid' })
  async createFilePath(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: CreateCustomerFilePathDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.visaCaseService.createFilePath(customerId, dto, req.user.id);
  }

  /**
   * 分页读取指定客户名下的资料路径台账列表。
   *
   * @param customerId - 客户 ID
   * @param query - 路径分页与类型筛选查询参数
   * @returns 符合统一分页结构的路径列表响应体
   */
  @Get('customers/:customerId/file-paths')
  @Permissions(PermissionCodes.CUSTOMER_FILE_PATH_LIST)
  @ApiOperation({ summary: '顧客資料パス一覧取得' })
  @ApiParam({ name: 'customerId', type: 'string', format: 'uuid' })
  async findFilePathsByCustomer(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Query() query: QueryCustomerFilePathDto,
  ) {
    const result = await this.visaCaseService.findFilePathsByCustomer(
      customerId,
      query,
    );
    return ApiResponse.paginated(
      result.items,
      result.total,
      result.page,
      result.pageSize,
    );
  }

  /**
   * 分页读取指定签证案件下的资料路径台账列表。
   *
   * @param visaCaseId - 签证案件 ID
   * @param query - 路径分页与类型筛选查询参数
   * @param req - 携带当前登录用户 ID 的认证请求对象
   * @returns 符合统一分页结构的路径列表响应体
   */
  @Get('visa-cases/:visaCaseId/file-paths')
  @Permissions(PermissionCodes.CUSTOMER_FILE_PATH_LIST)
  @ApiOperation({ summary: 'ビザ案件資料パス一覧取得' })
  @ApiParam({ name: 'visaCaseId', type: 'string', format: 'uuid' })
  async findFilePathsByVisaCase(
    @Param('visaCaseId', ParseUUIDPipe) visaCaseId: string,
    @Query() query: QueryCustomerFilePathDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = await this.visaCaseService.findFilePathsByVisaCase(
      visaCaseId,
      query,
      req.user.id,
    );
    return ApiResponse.paginated(
      result.items,
      result.total,
      result.page,
      result.pageSize,
    );
  }

  /**
   * 更新指定资料路径台账记录的可编辑字段。
   *
   * @param id - 路径记录 ID
   * @param dto - 路径更新请求体
   * @param req - 携带当前登录用户 ID 的认证请求对象
   * @returns 更新后的路径响应体
   */
  @Put('file-paths/:id')
  @Permissions(PermissionCodes.CUSTOMER_FILE_PATH_EDIT)
  @AuditAction({
    action: AuditActionType.UPDATE,
    targetType: AuditTargetType.CUSTOMER_FILE_PATH,
  })
  @ApiOperation({ summary: '資料パス更新' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async updateFilePath(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerFilePathDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.visaCaseService.updateFilePath(id, dto, req.user.id);
  }

  /**
   * 对指定资料路径记录执行逻辑删除。
   *
   * @param id - 路径记录 ID
   * @param req - 携带当前登录用户 ID 的认证请求对象
   * @returns 空响应体
   */
  @Delete('file-paths/:id')
  @Permissions(PermissionCodes.CUSTOMER_FILE_PATH_DELETE)
  @HttpCode(HttpStatus.OK)
  @AuditAction({
    action: AuditActionType.DELETE,
    targetType: AuditTargetType.CUSTOMER_FILE_PATH,
  })
  @ApiOperation({ summary: '資料パス削除（論理削除）' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async removeFilePath(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.visaCaseService.removeFilePath(id, req.user.id);
    return null;
  }

  // ── 材料テンプレート管理 ─────────────────────────────

  /**
   * 全量取得活跃材料模板列表。
   *
   * @returns 模板数组
   */
  @Get('material-templates')
  @Permissions(PermissionCodes.MATERIAL_TEMPLATE_MANAGE)
  @ApiOperation({ summary: '材料テンプレート一覧取得' })
  async findAllTemplates() {
    return this.visaCaseService.findAllTemplates();
  }

  /**
   * 创建一个新的材料模板及子项。
   *
   * @param dto - 模板创建请求体
   * @returns 新创建的模板响应体
   */
  @Post('material-templates')
  @Permissions(PermissionCodes.MATERIAL_TEMPLATE_MANAGE)
  @AuditAction({
    action: AuditActionType.CREATE,
    targetType: AuditTargetType.MATERIAL_TEMPLATE,
  })
  @ApiOperation({ summary: '材料テンプレート新規作成' })
  async createTemplate(@Body() dto: CreateMaterialTemplateDto) {
    return this.visaCaseService.createTemplate(dto);
  }

  /**
   * 更新指定材料模板的名称或全量替换模板项。
   *
   * @param id - 模板 ID
   * @param dto - 模板更新请求体
   * @returns 更新后的模板响应体
   */
  @Put('material-templates/:id')
  @Permissions(PermissionCodes.MATERIAL_TEMPLATE_MANAGE)
  @AuditAction({
    action: AuditActionType.UPDATE,
    targetType: AuditTargetType.MATERIAL_TEMPLATE,
  })
  @ApiOperation({ summary: '材料テンプレート更新' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async updateTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMaterialTemplateDto,
  ) {
    return this.visaCaseService.updateTemplate(id, dto);
  }

  /**
   * 停用指定材料模板（逻辑删除）。
   *
   * @param id - 模板 ID
   * @returns 空响应体
   */
  @Delete('material-templates/:id')
  @Permissions(PermissionCodes.MATERIAL_TEMPLATE_MANAGE)
  @HttpCode(HttpStatus.OK)
  @AuditAction({
    action: AuditActionType.DELETE,
    targetType: AuditTargetType.MATERIAL_TEMPLATE,
  })
  @ApiOperation({ summary: '材料テンプレート停用' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async deactivateTemplate(@Param('id', ParseUUIDPipe) id: string) {
    await this.visaCaseService.deactivateTemplate(id);
    return null;
  }

  // ── 案件材料チェックリスト ───────────────────────────

  /**
   * 从模板实例化材料项到指定案件（幂等：已有实例则直接返回）。
   *
   * @param id - 签证案件 ID
   * @param req - 携带当前登录用户 ID 的认证请求对象
   * @returns 实例化后的材料项列表
   */
  @Post('visa-cases/:id/materials/initialize')
  @Permissions(PermissionCodes.VISA_CASE_EDIT)
  @AuditAction({
    action: AuditActionType.UPDATE,
    targetType: AuditTargetType.VISA_CASE,
  })
  @ApiOperation({ summary: '案件材料テンプレートからの初期化' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async initializeMaterials(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.visaCaseService.initializeMaterials(id, req.user.id);
  }

  /**
   * 取得指定案件下的全部材料项列表。
   *
   * @param id - 签证案件 ID
   * @param req - 携带当前登录用户 ID 的认证请求对象
   * @returns 按排序的材料项列表
   */
  @Get('visa-cases/:id/materials')
  @Permissions(PermissionCodes.VISA_CASE_DETAIL)
  @ApiOperation({ summary: '案件材料一覧取得' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async findMaterials(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.visaCaseService.findMaterials(id, req.user.id);
  }

  /**
   * 手动新增一条材料项到指定案件。
   *
   * @param id - 签证案件 ID
   * @param dto - 材料项创建请求体
   * @param req - 携带当前登录用户 ID 的认证请求对象
   * @returns 新创建的材料项响应体
   */
  @Post('visa-cases/:id/materials')
  @Permissions(PermissionCodes.VISA_CASE_EDIT)
  @AuditAction({
    action: AuditActionType.UPDATE,
    targetType: AuditTargetType.VISA_CASE,
  })
  @ApiOperation({ summary: '案件材料手動追加' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async createMaterialItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateVisaCaseMaterialItemDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.visaCaseService.createMaterialItem(id, dto, req.user.id);
  }

  /**
   * 更新指定案件材料项的状态、备注或排序。
   *
   * @param id - 签证案件 ID
   * @param itemId - 材料项 ID
   * @param dto - 材料项更新请求体
   * @param req - 携带当前登录用户 ID 的认证请求对象
   * @returns 更新后的材料项响应体
   */
  @Put('visa-cases/:id/materials/:itemId')
  @Permissions(PermissionCodes.VISA_CASE_EDIT)
  @AuditAction({
    action: AuditActionType.UPDATE,
    targetType: AuditTargetType.VISA_CASE,
  })
  @ApiOperation({ summary: '案件材料更新' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'itemId', type: 'string', format: 'uuid' })
  async updateMaterialItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateVisaCaseMaterialItemDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.visaCaseService.updateMaterialItem(
      id,
      itemId,
      dto,
      req.user.id,
    );
  }

  /**
   * 删除手动新增的材料项（模板来源项不可删除，只能标不适用）。
   *
   * @param id - 签证案件 ID
   * @param itemId - 材料项 ID
   * @param req - 携带当前登录用户 ID 的认证请求对象
   * @returns 空响应体
   */
  @Delete('visa-cases/:id/materials/:itemId')
  @Permissions(PermissionCodes.VISA_CASE_EDIT)
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuditAction({
    action: AuditActionType.UPDATE,
    targetType: AuditTargetType.VISA_CASE,
  })
  @ApiOperation({ summary: '案件手動材料削除' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'itemId', type: 'string', format: 'uuid' })
  async deleteMaterialItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.visaCaseService.deleteMaterialItem(id, itemId, req.user.id);
  }

  /**
   * 取得案件材料的完成统计与建议 material_status。
   *
   * @param id - 签证案件 ID
   * @param req - 携带当前登录用户 ID 的认证请求对象
   * @returns 含完成数与建议状态的摘要
   */
  @Get('visa-cases/:id/materials/summary')
  @Permissions(PermissionCodes.VISA_CASE_DETAIL)
  @ApiOperation({ summary: '案件材料サマリー取得' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async getMaterialSummary(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.visaCaseService.getMaterialSummary(id, req.user.id);
  }

  /**
   * 将 checklist 建议的 material_status 同步写入案件表。
   *
   * @param id - 签证案件 ID
   * @param req - 携带当前登录用户 ID 的认证请求对象
   * @returns 同步后的摘要
   */
  @Post('visa-cases/:id/materials/sync-status')
  @Permissions(PermissionCodes.VISA_CASE_EDIT)
  @AuditAction({
    action: AuditActionType.UPDATE,
    targetType: AuditTargetType.VISA_CASE,
  })
  @ApiOperation({ summary: '材料ステータス同期' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async syncMaterialStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.visaCaseService.syncMaterialStatus(id, req.user.id);
  }
}
