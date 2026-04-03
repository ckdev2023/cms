import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

import { TaxContractStatus } from '../../../common/constants/enums';

/**
 * 定义税务顾问契约状态更新请求体，限制状态值只能落在既定业务枚举内。
 */
export class UpdateTaxContractStatusDto {
  @ApiProperty({ enum: TaxContractStatus })
  @IsEnum(TaxContractStatus, { message: '契約ステータスが無効です' })
  contractStatus: TaxContractStatus;
}
