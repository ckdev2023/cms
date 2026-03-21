import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AdminCaseController } from './admin-case.controller'
import { AdminCaseService } from './admin-case.service'
import { AdminCase } from './entities/admin-case.entity'
import { AdminCaseInterview } from './entities/admin-case-interview.entity'
import { AdminCaseDocument } from './entities/admin-case-document.entity'
import { AdminCaseTask } from './entities/admin-case-task.entity'

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
