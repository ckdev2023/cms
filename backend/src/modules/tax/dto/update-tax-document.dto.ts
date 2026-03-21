import { PartialType } from '@nestjs/swagger'
import { CreateTaxDocumentDto } from './create-tax-document.dto'

export class UpdateTaxDocumentDto extends PartialType(CreateTaxDocumentDto) {}
