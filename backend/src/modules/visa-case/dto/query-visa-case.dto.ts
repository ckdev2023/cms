import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

import {
  MaterialStatus,
  VisaCaseStatus,
  VisaDataScope,
} from '../../../common/constants/enums';
import { PaginationDto } from '../../../common/dto/pagination.dto';

/**
 * 定义签证案件列表查询条件，统一承载案件状态、负责人、材料状态筛选与分页参数。
 */
export class QueryVisaCaseDto extends PaginationDto {
  @ApiPropertyOptional({ enum: VisaCaseStatus })
  @IsOptional()
  @IsEnum(VisaCaseStatus)
  caseStatus?: VisaCaseStatus;

  @ApiPropertyOptional({ format: 'uuid', description: '按负责人筛选' })
  @IsOptional()
  @IsUUID('4', { message: '担当者IDの形式が無効です' })
  assignedTo?: string;

  @ApiPropertyOptional({ enum: MaterialStatus, description: '按材料状态筛选' })
  @IsOptional()
  @IsEnum(MaterialStatus)
  materialStatus?: MaterialStatus;

  @ApiPropertyOptional({
    enum: VisaDataScope,
    description: '客户上下文书案件列表的数据范围（docs/21 §18）；缺省 all',
  })
  @IsOptional()
  @IsEnum(VisaDataScope)
  dataScope?: VisaDataScope;
}
