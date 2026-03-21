import { Global, Module } from '@nestjs/common'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { TypeOrmModule } from '@nestjs/typeorm'
import { LogController } from './log.controller'
import { LogService } from './log.service'
import { AuditLogInterceptor } from './interceptors/audit-log.interceptor'
import { AuditLog } from './entities/audit-log.entity'
import { LoginLog } from './entities/login-log.entity'
import { ExportLog } from './entities/export-log.entity'

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog, LoginLog, ExportLog])],
  controllers: [LogController],
  providers: [
    LogService,
    { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },
  ],
  exports: [LogService, TypeOrmModule],
})
export class LogModule {}
