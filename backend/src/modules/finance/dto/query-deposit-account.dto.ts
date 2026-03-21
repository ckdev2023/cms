import { IsOptional, IsUUID } from 'class-validator'
import { Transform } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { PaginationDto } from '../../../common/dto/pagination.dto'

export class QueryDepositAccountDto extends PaginationDto {
  @ApiPropertyOptional({ description: '顧客ID' })
  @IsOptional()
  @IsUUID()
  customerId?: string

  @ApiPropertyOptional({ description: '残高ありのみ', type: Boolean })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  hasBalance?: boolean
}
