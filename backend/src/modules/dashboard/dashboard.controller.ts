import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger'
import { Permissions } from '../auth/decorators'
import { PermissionCodes } from '../../common/constants/permission-codes'
import { ApiResponse } from '../../common/helpers/api-response.helper'
import { DashboardService } from './dashboard.service'

@ApiTags('ワークステーション')
@Controller('dashboard')
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @Permissions(PermissionCodes.DASHBOARD_VIEW)
  @ApiOperation({ summary: 'ダッシュボード概要取得' })
  async getSummary() {
    const data = await this.dashboardService.getSummary()
    return ApiResponse.success(data)
  }

  @Get('expiring')
  @Permissions(PermissionCodes.DASHBOARD_VIEW)
  @ApiOperation({ summary: '期限切れ・期限間近の一覧取得' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: '何日以内の期限を取得するか（デフォルト30日）' })
  async getExpiringItems(@Query('days') days?: string) {
    const d = days ? parseInt(days, 10) : 30
    const data = await this.dashboardService.getExpiringItems(
      isNaN(d) ? 30 : d,
    )
    return ApiResponse.success(data)
  }

  @Get('finance-summary')
  @Permissions(PermissionCodes.DASHBOARD_VIEW)
  @ApiOperation({ summary: '財務概要取得' })
  async getFinanceSummary() {
    const data = await this.dashboardService.getFinanceSummary()
    return ApiResponse.success(data)
  }

  @Get('recent-activity')
  @Permissions(PermissionCodes.DASHBOARD_VIEW)
  @ApiOperation({ summary: '最近の活動取得' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '取得件数（デフォルト10件）' })
  async getRecentActivity(@Query('limit') limit?: string) {
    const l = limit ? parseInt(limit, 10) : 10
    const data = await this.dashboardService.getRecentActivity(
      isNaN(l) ? 10 : Math.min(l, 50),
    )
    return ApiResponse.success(data)
  }
}
