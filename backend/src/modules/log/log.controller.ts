import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { PermissionCodes } from '../../common/constants/permission-codes';
import { ApiResponse } from '../../common/helpers/api-response.helper';
import type { IApiResponse } from '../../common/interfaces/api-response.interface';
import type { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { Permissions } from '../auth/decorators';
import { QueryAuditLogDto, QueryLoginLogDto } from './dto';
import type { AuditLogListItem, LoginLogListItem } from './log.service';
import { LogService } from './log.service';

/**
 * 提供审计日志与登录日志的分页查询接口。
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
}
