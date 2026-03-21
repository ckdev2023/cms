import { IsOptional, IsEnum, IsString } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { PaginationDto } from '../../../common/dto/pagination.dto'
import { UserStatus } from '../../../common/constants/enums'

export class QueryUserDto extends PaginationDto {
  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  roleCode?: string
}
