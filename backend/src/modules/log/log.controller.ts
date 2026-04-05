import { Controller, Get, Query, Req, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { PermissionCodes } from '../../common/constants/permission-codes';
import { ApiResponse } from '../../common/helpers/api-response.helper';
import type { IApiResponse } from '../../common/interfaces/api-response.interface';
import type { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { Permissions } from '../auth/decorators';
import {
  QueryAuditLogDto,
  QueryAuditLogExportDto,
  QueryExportLogDto,
  QueryLoginLogDto,
} from './dto';
import type {
  AuditLogListItem,
  ExportLogListItem,
  LoginLogListItem,
} from './log.service';
import { LogService } from './log.service';

type AuthenticatedRequest = Request & { user: { id: string } };

/**
 * 提供审计日志、登录日志与导出日志的分页查询接口。
 *
 * 控制器统一要求 `LOG_LIST` 权限，并复用标准响应体包装列表数据，
 * 以保证前端日志页面与其他后台列表接口保持一致的返回结构。
 */
@ApiTags('ログ')
@Controller('logs')
@ApiBearerAuth()
export class LogController {
  constructor(private readonly logService: LogService) {}

  /**
   * 返回审计日志分页列表，支持按操作人、动作类型和时间范围筛选。
   *
   * @param query - 审计日志查询条件
   * @returns 统一包装后的审计日志分页结果
   */
  @Get('audit')
  @Permissions(PermissionCodes.LOG_LIST)
  @ApiOperation({ summary: '操作ログ一覧取得' })
  async findAuditLogs(
    @Query() query: QueryAuditLogDto,
  ): Promise<IApiResponse<PaginatedResult<AuditLogListItem>>> {
    const result = await this.logService.findAuditLogs(query);
    return ApiResponse.paginated(
      result.items,
      result.total,
      result.page,
      result.pageSize,
    );
  }

  /**
   * 将当前筛选条件下的审计日志导出为 UTF-8 CSV（含 BOM），单次最多 5000 行，并写入 `export_logs`。
   *
   * @param query - 与列表相同的筛选与排序，另附 `limit`
   * @param req - 携带当前登录用户 ID 的认证请求对象
   * @returns 以 `StreamableFile` 形式返回的 CSV 附件流
   */
  @Get('audit/export.csv')
  @Permissions(PermissionCodes.LOG_LIST)
  @ApiOperation({ summary: '操作ログCSVエクスポート' })
  async exportAuditLogsCsv(
    @Query() query: QueryAuditLogExportDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<StreamableFile> {
    const { csv, fileName } = await this.logService.exportAuditLogsAsCsv(
      query,
      req.user.id,
    );
    const buffer = Buffer.from(`\ufeff${csv}`, 'utf-8');
    return new StreamableFile(buffer, {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="${fileName}"`,
    });
  }

  /**
   * 返回登录日志分页列表，支持按用户名、登录类型和结果筛选。
   *
   * @param query - 登录日志查询条件
   * @returns 统一包装后的登录日志分页结果
   */
  @Get('login')
  @Permissions(PermissionCodes.LOG_LIST)
  @ApiOperation({ summary: 'ログインログ一覧取得' })
  async findLoginLogs(
    @Query() query: QueryLoginLogDto,
  ): Promise<IApiResponse<PaginatedResult<LoginLogListItem>>> {
    const result = await this.logService.findLoginLogs(query);
    return ApiResponse.paginated(
      result.items,
      result.total,
      result.page,
      result.pageSize,
    );
  }

  /**
   * 返回导出日志分页列表，支持按操作者、导出类型、结果与时间范围筛选。
   *
   * @param query - 导出日志查询条件
   * @returns 统一包装后的导出日志分页结果
   */
  @Get('export')
  @Permissions(PermissionCodes.LOG_LIST)
  @ApiOperation({ summary: 'エクスポートログ一覧取得' })
  async findExportLogs(
    @Query() query: QueryExportLogDto,
  ): Promise<IApiResponse<PaginatedResult<ExportLogListItem>>> {
    const result = await this.logService.findExportLogs(query);
    return ApiResponse.paginated(
      result.items,
      result.total,
      result.page,
      result.pageSize,
    );
  }
}
