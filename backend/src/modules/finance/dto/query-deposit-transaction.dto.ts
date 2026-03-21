import { IsOptional, IsUUID, IsEnum, IsDateString } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { PaginationDto } from '../../../common/dto/pagination.dto'
import { DepositTransactionType } from '../../../common/constants/enums'

export class QueryDepositTransactionDto extends PaginationDto {
  @ApiPropertyOptional({ description: '預り金アカウントID' })
  @IsOptional()
  @IsUUID()
  depositAccountId?: string

  @ApiPropertyOptional({ description: '顧客ID' })
  @IsOptional()
  @IsUUID()
  customerId?: string

  @ApiPropertyOptional({ description: '取引種別', enum: DepositTransactionType })
  @IsOptional()
  @IsEnum(DepositTransactionType)
  transactionType?: DepositTransactionType

  @ApiPropertyOptional({ description: '関連請求書ID' })
  @IsOptional()
  @IsUUID()
  relatedInvoiceId?: string

  @ApiPropertyOptional({ description: '登録日From' })
  @IsOptional()
  @IsDateString()
  createdFrom?: string

  @ApiPropertyOptional({ description: '登録日To' })
  @IsOptional()
  @IsDateString()
  createdTo?: string
}
