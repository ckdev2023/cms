import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { PermissionCodes } from '../../common/constants/permission-codes';
import { ApiResponse } from '../../common/helpers/api-response.helper';
import { Permissions } from '../auth/decorators';
import { AdminCaseVisaSupplementService } from './admin-case-visa-supplement.service';
import { AdminCaseVisaSupplementRequestDto } from './dto/admin-case-visa-supplement.dto';

type AuthenticatedRequest = Request & { user: { id: string } };

/**
 * 行政案件向签证域补录的 REST 入口，与历史 CSV 导入控制器并列以保持 visa 模块边界清晰。
 */
@ApiTags('ビザ案件')
@ApiBearerAuth()
@Controller()
export class AdminCaseVisaSupplementController {
  constructor(
    private readonly supplementService: AdminCaseVisaSupplementService,
  ) {}

  /**
   * 对所选行政案件做 dry-run 预览，不写库。
   *
   * @param dto - 行政案件 UUID 列表
   * @returns 稳定内容哈希、行级校验结果与 `canProceed`
   */
  @Post('visa-cases/admin-case-supplement/preview')
  @Permissions(PermissionCodes.VISA_CASE_ADMIN_SUPPLEMENT)
  @ApiOperation({
    summary: '行政案件→ビザ案件補録プレビュー（dry-run）',
    description:
      'P2-S3d。`import_reference=admin:{adminCaseId}` で行级幂等。ERROR 行があると `canProceed=false`。',
  })
  async preview(@Body() dto: AdminCaseVisaSupplementRequestDto) {
    const data = await this.supplementService.preview(dto.adminCaseIds);
    return ApiResponse.success(data);
  }

  /**
   * 在预览无 ERROR 且批次未提交过时，逐行创建签证案件并写审计。
   *
   * @param dto - 与预览相同的行政案件 ID 集合（顺序无关）
   * @param req - 認証済みリクエスト
   * @returns 补录批次 ID、汇总与逐行 outcome
   */
  @Post('visa-cases/admin-case-supplement/commit')
  @Permissions(PermissionCodes.VISA_CASE_ADMIN_SUPPLEMENT)
  @ApiOperation({
    summary: '行政案件→ビザ案件補録確定',
    description:
      '同一 ID 集合の SHA-256 が既に記録されている場合は 409。失敗行はスキップし成功行は保持。',
  })
  async commit(
    @Body() dto: AdminCaseVisaSupplementRequestDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const ipAddress =
      (typeof req.ip === 'string' && req.ip) ||
      (req.socket?.remoteAddress ?? null);
    const deviceInfo =
      typeof req.headers['user-agent'] === 'string'
        ? req.headers['user-agent']
        : null;
    const data = await this.supplementService.commit(
      dto.adminCaseIds,
      req.user.id,
      ipAddress,
      deviceInfo,
    );
    return ApiResponse.success(data);
  }
}
