import { Controller } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { FinanceService } from './finance.service'

@ApiTags('財務')
@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}
}
