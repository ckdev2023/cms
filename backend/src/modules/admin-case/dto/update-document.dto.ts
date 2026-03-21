import { IsOptional, IsString, MaxLength } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class UpdateAdminCaseDocumentDto {
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
