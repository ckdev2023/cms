import { registerUpdateCaseTypeMaterialTests } from './visa-case.service.spec.case-type-materials';
import { registerCreateMaterialAutoInitTests } from './visa-case.service.spec.create-material-auto-init';
import {
  registerCreateTests,
  registerFindByCustomerTests,
  registerFindOneTests,
  registerInternalPrimaryCreateTests,
  registerUpdateTests,
} from './visa-case.service.spec.crud-core';
import {
  registerExternalPrimaryCreateTests,
  registerExternalPrimaryUpdateTests,
  registerInternalPrimaryUpdateTests,
} from './visa-case.service.spec.crud-primary';
import {
  registerAddFamilyMemberTests,
  registerListFamilyMembersTests,
  registerRemoveFamilyMemberTests,
  registerUpdateFamilyMemberTests,
} from './visa-case.service.spec.family';
import { registerFindAllGlobalCoreTests } from './visa-case.service.spec.global-list';
import { registerFindAllGlobalFilterTests } from './visa-case.service.spec.global-list-filters';
import {
  registerCreateLogTests,
  registerFindLogsTests,
  registerFindOneLogTests,
  registerRemoveLogTests,
  registerUpdateLogTests,
} from './visa-case.service.spec.logs';
import {
  registerCreateFilePathTests,
  registerFindFilePathsByCustomerTests,
  registerFindFilePathsByVisaCaseTests,
  registerRemoveFilePathTests,
  registerUpdateFilePathTests,
} from './visa-case.service.spec.paths';
import { registerFindVisaRemindersTests } from './visa-case.service.spec.reminders';
import { registerGetVisaDomainStatsTests } from './visa-case.service.spec.stats';
import { registerGetVisaWorkbenchAggregateTests } from './visa-case.service.spec.workbench';
import type {
  ContextAccessor,
  ServiceTestContext,
} from './visa-case.service.spec-helpers';
import { createTestingContext } from './visa-case.service.spec-helpers';

describe('VisaCaseService', () => {
  let context: ServiceTestContext;

  beforeEach(async () => {
    context = await createTestingContext();
  });

  const getContext: ContextAccessor = () => context;

  registerCreateTests(getContext);
  registerCreateMaterialAutoInitTests(getContext);
  registerInternalPrimaryCreateTests(getContext);
  registerExternalPrimaryCreateTests(getContext);
  registerFindByCustomerTests(getContext);
  registerFindOneTests(getContext);
  registerUpdateTests(getContext);
  registerUpdateCaseTypeMaterialTests(getContext);
  registerInternalPrimaryUpdateTests(getContext);
  registerExternalPrimaryUpdateTests(getContext);
  registerListFamilyMembersTests(getContext);
  registerAddFamilyMemberTests(getContext);
  registerUpdateFamilyMemberTests(getContext);
  registerRemoveFamilyMemberTests(getContext);
  registerCreateLogTests(getContext);
  registerFindLogsTests(getContext);
  registerFindOneLogTests(getContext);
  registerUpdateLogTests(getContext);
  registerRemoveLogTests(getContext);
  registerCreateFilePathTests(getContext);
  registerFindFilePathsByCustomerTests(getContext);
  registerFindFilePathsByVisaCaseTests(getContext);
  registerUpdateFilePathTests(getContext);
  registerRemoveFilePathTests(getContext);
  registerFindVisaRemindersTests(getContext);
  registerGetVisaDomainStatsTests(getContext);
  registerGetVisaWorkbenchAggregateTests(getContext);
  registerFindAllGlobalCoreTests(getContext);
  registerFindAllGlobalFilterTests(getContext);
});
