import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * 定义撤销既有入金记录时提交的入参契约。
 *
 * 该 DTO 要求提供撤销原因，供反转收款与审计记录同步留痕。
 */
export class ReversePaymentDto {
  @ApiProperty({ description: '取消理由', maxLength: 500 })
  @IsString()
  @IsNotEmpty({ message: '取消理由を入力してください' })
  @MaxLength(500)
  reversalReason: string;
}
