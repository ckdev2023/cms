import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

import { BusinessType } from '../../../common/constants/enums';
import { PaginationDto } from '../../../common/dto/pagination.dto';

/**
 * 定义文件列表查询接口支持的分页与筛选条件。
 */
export class QueryFileDto extends PaginationDto {
  @ApiPropertyOptional({
    description: '按关联业务类型筛选文件记录。',
    enum: BusinessType,
  })
  @IsOptional()
  @IsEnum(BusinessType)
  businessType?: BusinessType;

  @ApiPropertyOptional({ description: '按所属客户 ID 筛选文件记录。' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ description: '按上传人用户 ID 筛选文件记录。' })
  @IsOptional()
  @IsUUID()
  uploadedBy?: string;

  @ApiPropertyOptional({ description: '按关联业务对象 ID 筛选文件记录。' })
  @IsOptional()
  @IsUUID()
  relatedId?: string;

  @ApiPropertyOptional({ description: '按文件扩展名筛选文件记录。' })
  @IsOptional()
  @IsString()
  fileExt?: string;
}
