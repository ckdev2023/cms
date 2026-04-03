import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import * as fs from 'fs';
import { diskStorage } from 'multer';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

import {
  AuditActionType,
  AuditTargetType,
  BusinessType,
} from '../../common/constants/enums';
import { PermissionCodes } from '../../common/constants/permission-codes';
import { ApiResponse } from '../../common/helpers/api-response.helper';
import { Permissions } from '../auth/decorators';
import { AuditAction } from '../log/decorators';
import { QueryFileDto, UpdateFileDto } from './dto';
import { FileService } from './file.service';

type AuthenticatedRequest = Request & {
  user: {
    id: string;
  };
};

@ApiTags('ファイル')
@Controller('files')
@ApiBearerAuth()
export class FileController {
  constructor(private readonly fileService: FileService) {}

  /**
   * 接收 multipart 请求中的附件并写入文件模块上传流程。
   *
   * 该接口要求 `FILE_UPLOAD` 权限，上传成功后由 service 负责校验扩展名、
   * 落盘和持久化元数据。
   *
   * @param file - Multer 解析出的上传文件；未选择文件时为空
   * @param businessType - 附件所属业务模块类型
   * @param customerId - 关联客户主键，未传时不建立客户关联
   * @param relatedId - 关联业务记录主键，未传时不建立业务关联
   * @param description - 附件说明文本，未传时保持为空
   * @param req - 已通过鉴权的 HTTP 请求对象
   * @returns 上传完成后的附件实体
   * @throws {BadRequestException} 请求中未携带文件时抛出
   */
  @Post('upload')
  @Permissions(PermissionCodes.FILE_UPLOAD)
  @AuditAction({
    action: AuditActionType.UPLOAD,
    targetType: AuditTargetType.FILE,
  })
  @ApiOperation({ summary: 'ファイルアップロード' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        businessType: { type: 'string', enum: Object.values(BusinessType) },
        customerId: { type: 'string', format: 'uuid' },
        relatedId: { type: 'string', format: 'uuid' },
        description: { type: 'string' },
      },
      required: ['file', 'businessType'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const tmpDir = path.resolve(
            process.env.FILE_UPLOAD_DIR || './uploads',
            '_tmp',
          );
          fs.mkdirSync(tmpDir, { recursive: true });
          cb(null, tmpDir);
        },
        filename: (_req, _file, cb) => {
          cb(null, `${uuidv4()}_tmp`);
        },
      }),
      limits: { fileSize: 52_428_800 },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('businessType') businessType: BusinessType,
    @Body('customerId') customerId: string | undefined,
    @Body('relatedId') relatedId: string | undefined,
    @Body('description') description: string | undefined,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException('ファイルが選択されていません');
    }
    const userId = this.getUserId(req);
    return this.fileService.upload(
      file,
      businessType,
      userId,
      customerId,
      relatedId,
      description,
    );
  }

  /**
   * 按业务归属和分页条件返回附件列表。
   *
   * @param query - 附件筛选、排序与分页参数
   * @returns 符合统一分页结构的附件列表响应
   */
  @Get()
  @Permissions(PermissionCodes.FILE_LIST)
  @ApiOperation({ summary: 'ファイル一覧取得' })
  async findAll(@Query() query: QueryFileDto) {
    const result = await this.fileService.findAll(query);
    return ApiResponse.paginated(
      result.items,
      result.total,
      result.page,
      result.pageSize,
    );
  }

  /**
   * 根据附件主键返回单个附件详情。
   *
   * @param id - 附件主键 UUID
   * @returns 包含上传人信息的附件实体
   */
  @Get(':id')
  @Permissions(PermissionCodes.FILE_LIST)
  @ApiOperation({ summary: 'ファイル詳細取得' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.fileService.findOne(id);
  }

  /**
   * 生成附件下载响应并将文件流直接写入 HTTP 响应。
   *
   * @param id - 需要下载的附件主键 UUID
   * @param req - 已通过鉴权的 HTTP 请求对象
   * @param res - 用于写入下载头和文件流的原始响应对象
   * @returns 该方法直接结束响应，不返回 JSON 数据
   */
  @Get(':id/download')
  @Permissions(PermissionCodes.FILE_DOWNLOAD)
  @ApiOperation({ summary: 'ファイルダウンロード' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const userId = this.getUserId(req);
    const ip = this.getRequestIp(req);
    const { absPath, fileName, mimeType } =
      await this.fileService.getDownloadInfo(id, userId, ip);

    const encodedName = encodeURIComponent(fileName);
    res.setHeader('Content-Type', mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodedName}`,
    );
    fs.createReadStream(absPath).pipe(res);
  }

  /**
   * 以内联方式返回可预览附件的文件流。
   *
   * @param id - 需要预览的附件主键 UUID
   * @param req - 已通过鉴权的 HTTP 请求对象
   * @param res - 用于写入预览头和文件流的原始响应对象
   * @returns 该方法直接结束响应，不返回 JSON 数据
   */
  @Get(':id/preview')
  @Permissions(PermissionCodes.FILE_DOWNLOAD)
  @ApiOperation({ summary: 'ファイルプレビュー（画像・PDF）' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async preview(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const userId = this.getUserId(req);
    const ip = this.getRequestIp(req);
    const { absPath, mimeType } = await this.fileService.getPreviewInfo(
      id,
      userId,
      ip,
    );

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', 'inline');
    fs.createReadStream(absPath).pipe(res);
  }

  /**
   * 更新附件的说明和关联元数据。
   *
   * @param id - 需要更新的附件主键 UUID
   * @param dto - 附件元数据更新载荷
   * @returns 更新后的附件实体
   */
  @Put(':id')
  @Permissions(PermissionCodes.FILE_UPLOAD)
  @AuditAction({
    action: AuditActionType.UPDATE,
    targetType: AuditTargetType.FILE,
  })
  @ApiOperation({ summary: 'ファイルメタデータ更新' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFileDto,
  ) {
    return this.fileService.update(id, dto);
  }

  /**
   * 记录操作者信息后执行附件逻辑删除。
   *
   * @param id - 需要删除的附件主键 UUID
   * @param req - 已通过鉴权的 HTTP 请求对象
   * @returns 删除成功时返回空响应体
   */
  @Delete(':id')
  @Permissions(PermissionCodes.FILE_DELETE)
  @AuditAction({
    action: AuditActionType.DELETE,
    targetType: AuditTargetType.FILE,
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'ファイル削除（論理削除）' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const userId = this.getUserId(req);
    const ip = this.getRequestIp(req);
    await this.fileService.remove(id, userId, ip);
    return null;
  }

  /**
   * 从鉴权后的请求上下文中提取当前登录用户主键。
   *
   * @param req - 已通过权限守卫校验的请求对象
   * @returns 当前请求携带的用户 UUID
   */
  private getUserId(req: Request): string {
    return (req as AuthenticatedRequest).user.id;
  }

  /**
   * 提取附件访问日志使用的来源 IP 地址。
   *
   * @param req - 当前 HTTP 请求对象
   * @returns 优先返回 Express 解析后的 IP，缺失时回退到 socket 地址
   */
  private getRequestIp(req: Request): string | undefined {
    return req.ip || req.socket.remoteAddress;
  }
}
