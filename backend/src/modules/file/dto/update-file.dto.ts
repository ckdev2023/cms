import { IsOptional, IsString, IsEnum, MaxLength } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { BusinessType } from '../../../common/constants/enums'

export class UpdateFileDto {
  @ApiPropertyOptional({ description: 'ファイル名' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fileName?: string

  @ApiPropertyOptional({ description: 'ファイル説明' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string

  @ApiPropertyOptional({ description: 'ビジネスタイプ', enum: BusinessType })
  @IsOptional()
  @IsEnum(BusinessType)
  businessType?: BusinessType
}
