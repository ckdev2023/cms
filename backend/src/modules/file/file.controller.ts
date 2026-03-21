import {
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
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger'
import { diskStorage } from 'multer'
import { v4 as uuidv4 } from 'uuid'
import * as path from 'path'
import * as fs from 'fs'
import type { Request, Response } from 'express'
import { FileService } from './file.service'
import { QueryFileDto, UpdateFileDto } from './dto'
import { Permissions } from '../auth/decorators'
import { PermissionCodes } from '../../common/constants/permission-codes'
import { ApiResponse } from '../../common/helpers/api-response.helper'
import { AuditActionType, AuditTargetType, BusinessType } from '../../common/constants/enums'
import { AuditAction } from '../log/decorators'

@ApiTags('ファイル')
@Controller('files')
@ApiBearerAuth()
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Post('upload')
  @Permissions(PermissionCodes.FILE_UPLOAD)
  @AuditAction({ action: AuditActionType.UPLOAD, targetType: AuditTargetType.FILE })
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
          )
          fs.mkdirSync(tmpDir, { recursive: true })
          cb(null, tmpDir)
        },
        filename: (_req, _file, cb) => {
          cb(null, `${uuidv4()}_tmp`)
        },
      }),
      limits: { fileSize: 52_428_800 },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('businessType') businessType: BusinessType,
    @Body('customerId') customerId: string | undefined,
    @Body('relatedId') relatedId: string | undefined,
    @Body('description') description: string | undefined,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new Error('ファイルが選択されていません')
    }
    const userId = (req.user as { id: string }).id
    return this.fileService.upload(
      file,
      businessType,
      userId,
      customerId,
      relatedId,
      description,
    )
  }

  @Get()
  @Permissions(PermissionCodes.FILE_LIST)
  @ApiOperation({ summary: 'ファイル一覧取得' })
  async findAll(@Query() query: QueryFileDto) {
    const result = await this.fileService.findAll(query)
    return ApiResponse.paginated(
      result.items,
      result.total,
      result.page,
      result.pageSize,
    )
  }

  @Get(':id')
  @Permissions(PermissionCodes.FILE_LIST)
  @ApiOperation({ summary: 'ファイル詳細取得' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.fileService.findOne(id)
  }

  @Get(':id/download')
  @Permissions(PermissionCodes.FILE_DOWNLOAD)
  @ApiOperation({ summary: 'ファイルダウンロード' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const userId = (req.user as { id: string }).id
    const ip = req.ip || req.socket.remoteAddress
    const { absPath, fileName, mimeType } =
      await this.fileService.getDownloadInfo(id, userId, ip)

    const encodedName = encodeURIComponent(fileName)
    res.setHeader('Content-Type', mimeType)
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodedName}`,
    )
    fs.createReadStream(absPath).pipe(res)
  }

  @Get(':id/preview')
  @Permissions(PermissionCodes.FILE_DOWNLOAD)
  @ApiOperation({ summary: 'ファイルプレビュー（画像・PDF）' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async preview(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const userId = (req.user as { id: string }).id
    const ip = req.ip || req.socket.remoteAddress
    const { absPath, mimeType } =
      await this.fileService.getPreviewInfo(id, userId, ip)

    res.setHeader('Content-Type', mimeType)
    res.setHeader('Content-Disposition', 'inline')
    fs.createReadStream(absPath).pipe(res)
  }

  @Put(':id')
  @Permissions(PermissionCodes.FILE_UPLOAD)
  @AuditAction({ action: AuditActionType.UPDATE, targetType: AuditTargetType.FILE })
  @ApiOperation({ summary: 'ファイルメタデータ更新' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFileDto,
  ) {
    return this.fileService.update(id, dto)
  }

  @Delete(':id')
  @Permissions(PermissionCodes.FILE_DELETE)
  @AuditAction({ action: AuditActionType.DELETE, targetType: AuditTargetType.FILE })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'ファイル削除（論理削除）' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    const userId = (req.user as { id: string }).id
    const ip = req.ip || req.socket.remoteAddress
    await this.fileService.remove(id, userId, ip)
    return null
  }
}
