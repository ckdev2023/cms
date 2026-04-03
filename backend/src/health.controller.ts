import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from './modules/auth/decorators';

export interface HealthCheckResponse {
  status: 'ok';
  timestamp: string;
}

/**
 * 提供无需鉴权的服务存活检查接口。
 */
@ApiTags('Health')
@Controller('health')
export class HealthController {
  /**
   * 返回当前 API 进程的存活状态与生成时间戳。
   *
   * @returns 包含固定 `ok` 状态与 ISO 时间戳的健康检查结果
   */
  @Get()
  @Public()
  @ApiOperation({ summary: '返回服务存活状态与时间戳' })
  check(): HealthCheckResponse {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
