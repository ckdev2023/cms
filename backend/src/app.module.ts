import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { join } from 'path'
import { SnakeNamingStrategy } from './common/naming-strategy'
import { AuthModule } from './modules/auth/auth.module'
import { CustomerModule } from './modules/customer/customer.module'
import { AdminCaseModule } from './modules/admin-case/admin-case.module'
import { TaxModule } from './modules/tax/tax.module'
import { FinanceModule } from './modules/finance/finance.module'
import { FileModule } from './modules/file/file.module'
import { SystemModule } from './modules/system/system.module'
import { LogModule } from './modules/log/log.module'
import { DashboardModule } from './modules/dashboard/dashboard.module'
import { HealthController } from './health.controller'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USERNAME', 'postgres'),
        password: configService.get<string>('DB_PASSWORD', 'postgres'),
        database: configService.get<string>('DB_DATABASE', 'jimusho_cms'),
        autoLoadEntities: true,
        migrations: [join(__dirname, 'migrations/*{.ts,.js}')],
        synchronize: configService.get<string>('DB_SYNCHRONIZE', 'false') === 'true',
        logging: configService.get<string>('NODE_ENV', 'development') === 'development',
        migrationsRun: configService.get<string>('DB_MIGRATIONS_RUN', 'false') === 'true',
        namingStrategy: new SnakeNamingStrategy(),
      }),
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
  ],
  controllers: [HealthController],
})
export class AppModule {}
