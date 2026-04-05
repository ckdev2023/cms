import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { createTypeOrmModuleOptions } from './data-source';
import { HealthController } from './health.controller';
import { AdminCaseModule } from './modules/admin-case/admin-case.module';
import { AuthModule } from './modules/auth/auth.module';
import { CustomerModule } from './modules/customer/customer.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { FileModule } from './modules/file/file.module';
import { FinanceModule } from './modules/finance/finance.module';
import { LogModule } from './modules/log/log.module';
import { SystemModule } from './modules/system/system.module';
import { TaxModule } from './modules/tax/tax.module';
import { VisaCaseModule } from './modules/visa-case/visa-case.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        createTypeOrmModuleOptions(configService),
    }),
    AuthModule,
    CustomerModule,
    AdminCaseModule,
    TaxModule,
    FinanceModule,
    FileModule,
    SystemModule,
    LogModule,
    DashboardModule,
    VisaCaseModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
