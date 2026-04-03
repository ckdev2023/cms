import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

/**
 * 提供财务领域的根路由占位入口，便于后续聚合跨子模块的财务概览接口。
 */
@ApiTags('財務')
@Controller('finance')
export class FinanceController {}
