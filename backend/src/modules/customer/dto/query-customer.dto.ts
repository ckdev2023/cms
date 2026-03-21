import { IsOptional, IsEnum, IsString } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { PaginationDto } from '../../../common/dto/pagination.dto'
import {
  CustomerType,
  ServiceType,
  CustomerStatus,
} from '../../../common/constants/enums'

export class QueryCustomerDto extends PaginationDto {
  @ApiPropertyOptional({ enum: CustomerType })
  @IsOptional()
  @IsEnum(CustomerType)
  customerType?: CustomerType

  @ApiPropertyOptional({ enum: ServiceType })
  @IsOptional()
  @IsEnum(ServiceType)
  serviceType?: ServiceType

  @ApiPropertyOptional({ enum: CustomerStatus })
  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerUserId?: string
}
