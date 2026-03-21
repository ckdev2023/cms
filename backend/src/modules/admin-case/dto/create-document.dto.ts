import { IsUUID, IsOptional, IsString, MaxLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreateAdminCaseDocumentDto {
  @ApiProperty({ description: 'ファイルID', format: 'uuid' })
  @IsUUID()
  fileId: string

  @ApiPropertyOptional({ description: '書類タイプ' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  documentType?: string

  @ApiPropertyOptional({ description: '備考' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string
}
