import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import { VisaCaseMemberRole } from '../../../common/constants/enums';

/**
 * 定义向签证案件挂载家属成员时的入参结构，约束客户归属、角色与主申请人标记。
 *
 * 同一案件内 `isPrimary = true` 仅允许一人；角色须与案件实际家庭关系一致。
 */
export class CreateVisaCaseFamilyMemberDto {
  @ApiProperty({ format: 'uuid', description: '挂载客户ID' })
  @IsUUID('4', { message: '顧客IDの形式が無効です' })
  customerId: string;

  @ApiProperty({ enum: VisaCaseMemberRole, description: '成员角色' })
  @IsEnum(VisaCaseMemberRole, { message: 'メンバー役割が無効です' })
  memberRole: VisaCaseMemberRole;

  @ApiPropertyOptional({ default: false, description: '是否为主申请人' })
  @IsOptional()
  @IsBoolean({ message: '主申請者フラグはブール値が必要です' })
  isPrimary?: boolean;

  @ApiProperty({ maxLength: 200, description: '成员姓名快照' })
  @IsString()
  @MaxLength(200)
  displayNameSnapshot: string;
}
