import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DepositController } from './deposit.controller';
import { DepositService } from './deposit.service';
import { DepositAccount } from './entities/deposit-account.entity';
import { DepositTransaction } from './entities/deposit-transaction.entity';
import { Invoice } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { Payment } from './entities/payment.entity';
import { PaymentAllocation } from './entities/payment-allocation.entity';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { InvoiceController } from './invoice.controller';
import { InvoiceService } from './invoice.service';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

/**
 * 汇总财务领域的控制器、服务和实体仓储注册，供发票、入金与预り金模块共享。
 */
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
