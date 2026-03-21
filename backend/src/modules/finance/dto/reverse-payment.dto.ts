import { IsString, IsNotEmpty, MaxLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class ReversePaymentDto {
  @ApiProperty({ description: '取消理由', maxLength: 500 })
  @IsString()
  @IsNotEmpty({ message: '取消理由を入力してください' })
  @MaxLength(500)
  reversalReason: string
}
