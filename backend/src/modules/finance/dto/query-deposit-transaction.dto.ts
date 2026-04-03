import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';

import { DepositTransactionType } from '../../../common/constants/enums';
import { PaginationDto } from '../../../common/dto/pagination.dto';

/**
 * 定义查询预り金流水列表时可用的筛选入参契约。
 *
 * 该 DTO 支持按账户、客户、流水类型、关联请求书与登记时间范围组合过滤。
 */
export class QueryDepositTransactionDto extends PaginationDto {
  @ApiPropertyOptional({ description: '預り金アカウントID' })
  @IsOptional()
  @IsUUID()
  depositAccountId?: string;

  @ApiPropertyOptional({ description: '顧客ID' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({
    description: '取引種別',
    enum: DepositTransactionType,
  })
  @IsOptional()
  @IsEnum(DepositTransactionType)
  transactionType?: DepositTransactionType;

  @ApiPropertyOptional({ description: '関連請求書ID' })
  @IsOptional()
  @IsUUID()
  relatedInvoiceId?: string;

  @ApiPropertyOptional({ description: '登録日From' })
  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @ApiPropertyOptional({ description: '登録日To' })
  @IsOptional()
  @IsDateString()
  createdTo?: string;
}
