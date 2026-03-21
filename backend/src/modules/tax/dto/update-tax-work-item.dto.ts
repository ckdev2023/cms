import { PartialType } from '@nestjs/swagger'
import { CreateTaxWorkItemDto } from './create-tax-work-item.dto'

export class UpdateTaxWorkItemDto extends PartialType(CreateTaxWorkItemDto) {}
