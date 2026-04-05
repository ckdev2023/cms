import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { VisaCaseMemberRole } from '../../../common/constants/enums';

/**
 * 定义更新签证案件家属成员时的可编辑字段，所有字段均为可选。
 *
 * 修改 `isPrimary` 为 true 时，原主申请人的标记将被服务层自动取消。
 */
export class UpdateVisaCaseFamilyMemberDto {
  @ApiPropertyOptional({ enum: VisaCaseMemberRole, description: '成员角色' })
  @IsOptional()
  @IsEnum(VisaCaseMemberRole, { message: 'メンバー役割が無効です' })
  memberRole?: VisaCaseMemberRole;

  @ApiPropertyOptional({ default: false, description: '是否为主申请人' })
  @IsOptional()
  @IsBoolean({ message: '主申請者フラグはブール値が必要です' })
  isPrimary?: boolean;

  @ApiPropertyOptional({ maxLength: 200, description: '成员姓名快照' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  displayNameSnapshot?: string;
}
