import { IsEnum } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { TaxContractStatus } from '../../../common/constants/enums'

export class UpdateTaxContractStatusDto {
  @ApiProperty({ enum: TaxContractStatus })
  @IsEnum(TaxContractStatus, { message: '契約ステータスが無効です' })
  contractStatus: TaxContractStatus
}
