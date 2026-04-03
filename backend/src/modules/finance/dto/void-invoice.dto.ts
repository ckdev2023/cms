import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * 定义将请求书作废时提交的入参契约。
 *
 * 该 DTO 要求提供作废原因，供账务追踪与后续审计记录使用。
 */
export class VoidInvoiceDto {
  @ApiProperty({ maxLength: 500, description: '無効理由' })
  @IsString()
  @IsNotEmpty({ message: '無効理由は必須です' })
  @MaxLength(500, { message: '無効理由は500文字以内で入力してください' })
  voidReason: string;
}
