import { IsOptional, IsEnum, IsString, IsUUID } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { PaginationDto } from '../../../common/dto/pagination.dto'
import { BusinessType } from '../../../common/constants/enums'

export class QueryFileDto extends PaginationDto {
  @ApiPropertyOptional({ enum: BusinessType })
  @IsOptional()
  @IsEnum(BusinessType)
  businessType?: BusinessType

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customerId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  uploadedBy?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  relatedId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fileExt?: string
}
