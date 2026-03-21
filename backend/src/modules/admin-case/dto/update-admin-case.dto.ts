import { PartialType } from '@nestjs/swagger'
import { CreateAdminCaseDto } from './create-admin-case.dto'

export class UpdateAdminCaseDto extends PartialType(CreateAdminCaseDto) {}
