import { PartialType } from '@nestjs/swagger'
import { CreateTaxContractDto } from './create-tax-contract.dto'

export class UpdateTaxContractDto extends PartialType(CreateTaxContractDto) {}
