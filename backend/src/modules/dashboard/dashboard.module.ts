import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DashboardController } from './dashboard.controller'
import { DashboardService } from './dashboard.service'
import { Customer } from '../customer/entities/customer.entity'
import { AdminCase } from '../admin-case/entities/admin-case.entity'
import { TaxPeriod } from '../tax/entities/tax-period.entity'
import { TaxContract } from '../tax/entities/tax-contract.entity'
import { Invoice } from '../finance/entities/invoice.entity'
import { Note } from '../customer/entities/note.entity'
import { FileEntity } from '../file/entities/file.entity'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Customer,
      AdminCase,
      TaxPeriod,
      TaxContract,
      Invoice,
      Note,
      FileEntity,
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
