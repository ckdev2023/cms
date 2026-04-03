import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  TaxContract,
  TaxMonthlyDocument,
  TaxMonthlyWorkItem,
  TaxPeriod,
} from './entities';
import { TaxController } from './tax.controller';
import { TaxService } from './tax.service';

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
