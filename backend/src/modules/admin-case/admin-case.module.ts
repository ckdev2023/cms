import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AdminCaseController } from './admin-case.controller';
import { AdminCaseService } from './admin-case.service';
import { AdminCase } from './entities/admin-case.entity';
import { AdminCaseDocument } from './entities/admin-case-document.entity';
import { AdminCaseInterview } from './entities/admin-case-interview.entity';
import { AdminCaseTask } from './entities/admin-case-task.entity';

/**
 * 聚合行政案件模块的控制器、服务与持久化实体注册。
 *
 * 该模块向其他业务域导出 `AdminCaseService`，供客户、日志等场景复用案件领域能力。
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      AdminCase,
      AdminCaseInterview,
      AdminCaseDocument,
      AdminCaseTask,
    ]),
  ],
  controllers: [AdminCaseController],
  providers: [AdminCaseService],
  exports: [AdminCaseService],
})
export class AdminCaseModule {}
