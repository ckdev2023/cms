import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsBoolean,
  MaxLength,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreateTaxDocumentDto {
  @ApiProperty({ maxLength: 200 })
  @IsString()
  @IsNotEmpty({ message: '資料名は必須です' })
  @MaxLength(200)
  documentName: string

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'ファイルIDの形式が無効です' })
  fileId?: string

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  received?: boolean

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string
}
