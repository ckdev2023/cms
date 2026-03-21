import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { InvoiceController } from './invoice.controller'
import { InvoiceService } from './invoice.service'
import { PaymentController } from './payment.controller'
import { PaymentService } from './payment.service'
import { DepositController } from './deposit.controller'
import { DepositService } from './deposit.service'
import { FinanceController } from './finance.controller'
import { FinanceService } from './finance.service'
import { Invoice } from './entities/invoice.entity'
import { InvoiceItem } from './entities/invoice-item.entity'
import { Payment } from './entities/payment.entity'
import { PaymentAllocation } from './entities/payment-allocation.entity'
import { DepositAccount } from './entities/deposit-account.entity'
import { DepositTransaction } from './entities/deposit-transaction.entity'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Invoice,
      InvoiceItem,
      Payment,
      PaymentAllocation,
      DepositAccount,
      DepositTransaction,
    ]),
  ],
  controllers: [
    InvoiceController,
    PaymentController,
    DepositController,
    FinanceController,
  ],
  providers: [InvoiceService, PaymentService, DepositService, FinanceService],
  exports: [InvoiceService, PaymentService, DepositService, FinanceService],
})
export class FinanceModule {}
