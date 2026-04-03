import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditLog } from './entities/audit-log.entity';
import { ExportLog } from './entities/export-log.entity';
import { LoginLog } from './entities/login-log.entity';
import { AuditLogInterceptor } from './interceptors/audit-log.interceptor';
import { LogController } from './log.controller';
import { LogService } from './log.service';

/**
 * 组装日志领域的实体仓储、查询接口与全局审计拦截能力。
 *
 * 模块以 `@Global()` 方式导出日志服务，供认证、财务等业务模块复用统一的日志写入入口。
 */
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
