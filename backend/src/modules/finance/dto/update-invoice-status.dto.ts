import { IsEnum } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { InvoiceStatus } from '../../../common/constants/enums'

export class UpdateInvoiceStatusDto {
  @ApiProperty({ enum: InvoiceStatus })
  @IsEnum(InvoiceStatus, { message: 'ステータスが無効です' })
  status: InvoiceStatus
}
