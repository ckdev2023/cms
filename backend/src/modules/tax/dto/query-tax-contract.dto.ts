import { IsOptional, IsEnum, IsString, IsDateString } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { PaginationDto } from '../../../common/dto/pagination.dto'
import { TaxContractStatus, BillingCycle } from '../../../common/constants/enums'

export class QueryTaxContractDto extends PaginationDto {
  @ApiPropertyOptional({ enum: TaxContractStatus })
  @IsOptional()
  @IsEnum(TaxContractStatus)
  contractStatus?: TaxContractStatus

  @ApiPropertyOptional({ enum: BillingCycle })
  @IsOptional()
  @IsEnum(BillingCycle)
  billingCycle?: BillingCycle

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsString()
  customerId?: string

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsString()
  ownerUserId?: string

  @ApiPropertyOptional({ example: '2026-01-01', description: '開始日の範囲開始' })
  @IsOptional()
  @IsDateString()
  startDateFrom?: string

  @ApiPropertyOptional({ example: '2026-12-31', description: '開始日の範囲終了' })
  @IsOptional()
  @IsDateString()
  startDateTo?: string
}
