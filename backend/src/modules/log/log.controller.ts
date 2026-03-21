import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { LogService } from './log.service'
import { QueryAuditLogDto, QueryLoginLogDto } from './dto'
import { Permissions } from '../auth/decorators'
import { PermissionCodes } from '../../common/constants/permission-codes'
import { ApiResponse } from '../../common/helpers/api-response.helper'

@ApiTags('ログ')
@Controller('logs')
@ApiBearerAuth()
export class LogController {
  constructor(private readonly logService: LogService) {}

  @Get('audit')
  @Permissions(PermissionCodes.LOG_LIST)
  @ApiOperation({ summary: '操作ログ一覧取得' })
  async findAuditLogs(@Query() query: QueryAuditLogDto) {
    const result = await this.logService.findAuditLogs(query)
    return ApiResponse.paginated(
      result.items,
      result.total,
      result.page,
      result.pageSize,
    )
  }

  @Get('login')
  @Permissions(PermissionCodes.LOG_LIST)
  @ApiOperation({ summary: 'ログインログ一覧取得' })
  async findLoginLogs(@Query() query: QueryLoginLogDto) {
    const result = await this.logService.findLoginLogs(query)
    return ApiResponse.paginated(
      result.items,
      result.total,
      result.page,
      result.pageSize,
    )
  }
}
