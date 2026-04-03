import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AdminCase } from '../admin-case/entities/admin-case.entity';
import { Customer } from '../customer/entities/customer.entity';
import { Note } from '../customer/entities/note.entity';
import { FileEntity } from '../file/entities/file.entity';
import { Invoice } from '../finance/entities/invoice.entity';
import { TaxContract } from '../tax/entities/tax-contract.entity';
import { TaxPeriod } from '../tax/entities/tax-period.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

/**
 * 组装工作台首页所需聚合查询依赖的仪表盘模块。
 */
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
