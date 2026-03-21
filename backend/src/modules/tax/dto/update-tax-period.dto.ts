import { PartialType } from '@nestjs/swagger'
import { CreateTaxPeriodDto } from './create-tax-period.dto'

export class UpdateTaxPeriodDto extends PartialType(CreateTaxPeriodDto) {}
