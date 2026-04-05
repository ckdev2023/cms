import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AdminCase } from '../admin-case/entities/admin-case.entity';
import { User } from '../auth/entities/user.entity';
import { Customer } from '../customer/entities/customer.entity';
import { Note } from '../customer/entities/note.entity';
import { AdminCaseVisaSupplementController } from './admin-case-visa-supplement.controller';
import { AdminCaseVisaSupplementService } from './admin-case-visa-supplement.service';
import { AdminCaseVisaSupplementBatch } from './entities/admin-case-visa-supplement-batch.entity';
import { CustomerFilePath } from './entities/customer-file-path.entity';
import { MaterialTemplate } from './entities/material-template.entity';
import { MaterialTemplateItem } from './entities/material-template-item.entity';
import { VisaCase } from './entities/visa-case.entity';
import { VisaCaseFamilyMember } from './entities/visa-case-family-member.entity';
import { VisaCaseImportBatch } from './entities/visa-case-import-batch.entity';
import { VisaCaseMaterialItem } from './entities/visa-case-material-item.entity';
import { VisaCaseDataScopeQueryGuard } from './guards/visa-case-data-scope-query.guard';
import { MaterialTemplateService } from './material-template.service';
import { VisaCaseController } from './visa-case.controller';
import { VisaCaseService } from './visa-case.service';
import { VisaCaseDataScopeService } from './visa-case-data-scope.service';
import { VisaCaseDataScopePermissionService } from './visa-case-data-scope-permission.service';
import { VisaCaseFamilyMemberService } from './visa-case-family-member.service';
import { VisaCaseFilePathService } from './visa-case-file-path.service';
import { VisaCaseImportController } from './visa-case-import.controller';
import { VisaCaseImportBatchService } from './visa-case-import-batch.service';
import { VisaCaseImportCommitService } from './visa-case-import-commit.service';
import { VisaCaseImportPreviewService } from './visa-case-import-preview.service';
import { VisaCaseInternalPrimaryService } from './visa-case-internal-primary.service';
import { VisaCaseLogService } from './visa-case-log.service';
import { VisaCaseLookupService } from './visa-case-lookup.service';
import { VisaCaseMaterialService } from './visa-case-material.service';
import { VisaCaseReminderService } from './visa-case-reminder.service';

/**
 * 注册签证案件域的持久化实体、服务与控制器，为客户上下文建案与案件管理提供完整能力。
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      VisaCase,
      VisaCaseFamilyMember,
      VisaCaseMaterialItem,
      CustomerFilePath,
      MaterialTemplate,
      MaterialTemplateItem,
      Customer,
      Note,
      VisaCaseImportBatch,
      AdminCaseVisaSupplementBatch,
      AdminCase,
      User,
    ]),
  ],
  controllers: [
    VisaCaseController,
    VisaCaseImportController,
    AdminCaseVisaSupplementController,
  ],
  providers: [
    VisaCaseLookupService,
    VisaCaseInternalPrimaryService,
    VisaCaseFamilyMemberService,
    VisaCaseLogService,
    VisaCaseFilePathService,
    VisaCaseDataScopeService,
    VisaCaseDataScopePermissionService,
    VisaCaseDataScopeQueryGuard,
    VisaCaseReminderService,
    MaterialTemplateService,
    VisaCaseMaterialService,
    VisaCaseService,
    VisaCaseImportPreviewService,
    VisaCaseImportCommitService,
    VisaCaseImportBatchService,
    AdminCaseVisaSupplementService,
  ],
  exports: [
    VisaCaseService,
    VisaCaseReminderService,
    VisaCaseDataScopeService,
    VisaCaseDataScopePermissionService,
    VisaCaseDataScopeQueryGuard,
    MaterialTemplateService,
    VisaCaseImportPreviewService,
    TypeOrmModule,
  ],
})
export class VisaCaseModule {}
