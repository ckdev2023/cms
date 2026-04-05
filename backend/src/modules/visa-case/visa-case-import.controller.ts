import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { memoryStorage } from 'multer';

import { PermissionCodes } from '../../common/constants/permission-codes';
import { ApiResponse } from '../../common/helpers/api-response.helper';
import { Permissions } from '../auth/decorators';
import { QueryVisaCaseImportBatchListDto } from './dto/query-visa-case-import-batch-list.dto';
import { VisaCaseImportBatchService } from './visa-case-import-batch.service';
import { VisaCaseImportCommitService } from './visa-case-import-commit.service';
import { VisaCaseImportPreviewService } from './visa-case-import-preview.service';

type AuthenticatedRequest = Request & { user: { id: string } };

/**
 * 历史签证 CSV 导入的预览与确定取込端点，与主案件 CRUD 控制器拆分以降低单文件体积。
 */
@ApiTags('ビザ案件')
@ApiBearerAuth()
@Controller()
export class VisaCaseImportController {
  constructor(
    private readonly visaCaseImportPreviewService: VisaCaseImportPreviewService,
    private readonly visaCaseImportCommitService: VisaCaseImportCommitService,
    private readonly visaCaseImportBatchService: VisaCaseImportBatchService,
  ) {}

  /**
   * 上传固定列 CSV，解析并校验历史签证导入行（dry-run），不写库。
   *
   * @param file - multipart 字段 `file` 的 CSV 内容（UTF-8）
   * @returns 行级错误码、警告与 `canProceed` 摘要
   */
  @Post('visa-cases/import/preview')
  @Permissions(PermissionCodes.VISA_CASE_IMPORT)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiOperation({
    summary: 'ビザ案件履歴インポートCSVプレビュー（dry-run）',
    description:
      '必須列: record_type。顧客解決: customer_id(UUID) または customer_code。' +
      'record_type=CASE|FAMILY_MEMBER|FILE_PATH|CASE_LOG。CASE で legacy_case_ref を付与すると DB 上の import_reference と突合し重複時は DUPLICATE_SKIPPED。',
  })
  async previewVisaCaseImport(
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('CSV ファイルを選択してください');
    }
    const data = await this.visaCaseImportPreviewService.previewFromBuffer(
      file.buffer,
    );
    return ApiResponse.success(data);
  }

  /**
   * 上传与预览相同的 CSV，在校验通过后分批写入案件/家属/路径/日志并返回逐行报告。
   *
   * @param file - multipart 字段 `file` の CSV 内容（UTF-8）
   * @param req - 認証済みリクエスト（ユーザー ID・IP・UA を監査に渡す）
   * @returns 取込バッチ ID・SHA-256・操作者・作成時刻・集計と各行 outcome
   */
  @Post('visa-cases/import/commit')
  @Permissions(PermissionCodes.VISA_CASE_IMPORT)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiOperation({
    summary: 'ビザ案件履歴インポートCSV確定取込',
    description:
      '事前に preview と同一内容で `canProceed=true` であること。成功後は同一内容 SHA-256 の再取込は 409。' +
      '行ごとに既存 VisaCaseService / 家族 / パス / ログサービスを呼び出し、失敗行はスキップして報告のみ。',
  })
  async commitVisaCaseImport(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('CSV ファイルを選択してください');
    }
    const ipAddress =
      (typeof req.ip === 'string' && req.ip) ||
      (req.socket?.remoteAddress ?? null);
    const deviceInfo =
      typeof req.headers['user-agent'] === 'string'
        ? req.headers['user-agent']
        : null;
    const data = await this.visaCaseImportCommitService.commitFromBuffer(
      file.buffer,
      req.user.id,
      file.originalname ?? null,
      ipAddress,
      deviceInfo,
    );
    return ApiResponse.success(data);
  }

  /**
   * 分页返回已成功写入的导入批次审计摘要，与 `docs/23` §6.4 批次表及 `audit_logs` 对账。
   *
   * @param query - 页码与每页条数
   * @returns 分页批次列表（`importBatchId`、`contentSha256`、`createdBy`、`createdAt`、`summary`）
   */
  @Get('visa-cases/import/batches')
  @Permissions(PermissionCodes.VISA_CASE_IMPORT)
  @ApiOperation({
    summary: 'ビザ履歴CSV取込成功バッチ一覧（監査・只読）',
    description:
      '`visa_case_import_batches` の只読一覧。操作者・内容 SHA・作成時刻・集計 JSON を返却し audit_logs と突合可能。',
  })
  async listVisaCaseImportBatches(
    @Query() query: QueryVisaCaseImportBatchListDto,
  ) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const { items, total } = await this.visaCaseImportBatchService.list(
      page,
      pageSize,
    );
    return ApiResponse.paginated(items, total, page, pageSize);
  }

  /**
   * 按批次主键返回单条审计信息，用于与 JSON 下载报告中的 `importBatchId` 核对。
   *
   * @param id - 批次 UUID
   * @returns 批次审计 DTO
   */
  @Get('visa-cases/import/batches/:id')
  @Permissions(PermissionCodes.VISA_CASE_IMPORT)
  @ApiOperation({
    summary: 'ビザ履歴CSV取込バッチ詳細（監査・只読）',
  })
  async getVisaCaseImportBatch(@Param('id', ParseUUIDPipe) id: string) {
    const row = await this.visaCaseImportBatchService.findOneById(id);
    if (!row) {
      throw new NotFoundException('指定した取込バッチが見つかりません');
    }
    return ApiResponse.success(row);
  }
}
