import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Equals,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * 案件材料チェックリスト全面再初期化の明示確認ボディ。
 *
 * フロントは案件タイプ変更などで既存行を破棄する前にダイアログで確認し、`confirm: true` のみ送信する。
 * `reason` は監査ログの `afterValue` に残る任意メモ。
 */
export class ReinitializeVisaCaseMaterialsDto {
  @ApiProperty({
    description: '材料一覧をテンプレートで全面置換する操作であることの明示確認',
    example: true,
  })
  @IsBoolean({ message: 'confirm は真偽値である必要があります' })
  @Equals(true, {
    message:
      '材料チェックリストの再初期化には confirm を true に設定してください',
  })
  confirm: boolean;

  @ApiPropertyOptional({
    description:
      '監査・運用向けの任意メモ（例：案件タイプを経営管理へ変更に伴う差し替え）',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
