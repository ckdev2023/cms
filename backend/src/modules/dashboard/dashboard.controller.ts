import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { PermissionCodes } from '../../common/constants/permission-codes';
import { ApiResponse } from '../../common/helpers/api-response.helper';
import { Permissions } from '../auth/decorators';
import { DashboardService } from './dashboard.service';

@ApiTags('ワークステーション')
@Controller('dashboard')
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * 返回首页四张概览卡片所需的聚合统计数据。
   *
   * @returns 包装为统一响应体的工作台概要统计结果
   */
  @Get('summary')
  @Permissions(PermissionCodes.DASHBOARD_VIEW)
  @ApiOperation({ summary: 'ダッシュボード概要取得' })
  async getSummary() {
    const data = await this.dashboardService.getSummary();

    return ApiResponse.success(data);
  }

  /**
   * 返回指定天数窗口内的案件到期与税务申报提醒。
   *
   * @param days - 查询参数中的天数窗口，非法值会回退到默认 30 天
   * @returns 包装为统一响应体的到期提醒列表
   */
  @Get('expiring')
  @Permissions(PermissionCodes.DASHBOARD_VIEW)
  @ApiOperation({ summary: '期限切れ・期限間近の一覧取得' })
  @ApiQuery({
    name: 'days',
    required: false,
    type: Number,
    description: '何日以内の期限を取得するか（デフォルト30日）',
  })
  async getExpiringItems(@Query('days') days?: string) {
    const normalizedDays = this.parsePositiveNumber(days, 30);
    const data = await this.dashboardService.getExpiringItems(normalizedDays);

    return ApiResponse.success(data);
  }

  /**
   * 返回首页财务卡片所需的请款状态与本月回款汇总。
   *
   * @returns 包装为统一响应体的财务概览数据
   */
  @Get('finance-summary')
  @Permissions(PermissionCodes.DASHBOARD_VIEW)
  @ApiOperation({ summary: '財務概要取得' })
  async getFinanceSummary() {
    const data = await this.dashboardService.getFinanceSummary();

    return ApiResponse.success(data);
  }

  /**
   * 返回首页活动流所需的最近备注与上传文件记录。
   *
   * @param limit - 查询参数中的条目上限，非法值回退到默认 10 条，最大不超过 50 条
   * @returns 包装为统一响应体的最近活动列表
   */
  @Get('recent-activity')
  @Permissions(PermissionCodes.DASHBOARD_VIEW)
  @ApiOperation({ summary: '最近の活動取得' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: '取得件数（デフォルト10件）',
  })
  async getRecentActivity(@Query('limit') limit?: string) {
    const normalizedLimit = this.parsePositiveNumber(limit, 10, 50);
    const data = await this.dashboardService.getRecentActivity(normalizedLimit);

    return ApiResponse.success(data);
  }

  /**
   * 将查询参数解析为正整数，并在非法输入时回退到默认值。
   *
   * @param rawValue - 原始查询参数字符串
   * @param fallback - 参数缺失或非法时采用的默认值
   * @param maxValue - 可选的上限值，传入后会对结果做截断
   * @returns 适合传递给 service 层的安全数值参数
   */
  private parsePositiveNumber(
    rawValue: string | undefined,
    fallback: number,
    maxValue?: number,
  ): number {
    const parsedValue = rawValue ? parseInt(rawValue, 10) : fallback;

    if (Number.isNaN(parsedValue) || parsedValue <= 0) {
      return fallback;
    }

    if (typeof maxValue === 'number') {
      return Math.min(parsedValue, maxValue);
    }

    return parsedValue;
  }
}
