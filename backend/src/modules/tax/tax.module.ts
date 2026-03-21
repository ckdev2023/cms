import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { TaxController } from './tax.controller'
import { TaxService } from './tax.service'
import { TaxContract } from './entities/tax-contract.entity'
import { TaxPeriod } from './entities/tax-period.entity'
import { TaxMonthlyDocument } from './entities/tax-monthly-document.entity'
import { TaxMonthlyWorkItem } from './entities/tax-monthly-work-item.entity'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TaxContract,
      TaxPeriod,
      TaxMonthlyDocument,
      TaxMonthlyWorkItem,
    ]),
  ],
  controllers: [TaxController],
  providers: [TaxService],
  exports: [TaxService],
})
export class TaxModule {}
