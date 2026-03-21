import { IsString, IsNotEmpty, MaxLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class VoidInvoiceDto {
  @ApiProperty({ maxLength: 500, description: '無効理由' })
  @IsString()
  @IsNotEmpty({ message: '無効理由は必須です' })
  @MaxLength(500, { message: '無効理由は500文字以内で入力してください' })
  voidReason: string
}
