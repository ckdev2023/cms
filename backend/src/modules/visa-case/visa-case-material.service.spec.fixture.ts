import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { Customer } from '../customer/entities/customer.entity';
import { MaterialTemplate } from './entities/material-template.entity';
import { MaterialTemplateItem } from './entities/material-template-item.entity';
import { VisaCase } from './entities/visa-case.entity';
import { VisaCaseFamilyMember } from './entities/visa-case-family-member.entity';
import { VisaCaseMaterialItem } from './entities/visa-case-material-item.entity';
import {
  createMockRepo,
  type RepoMock,
} from './material-checklist.spec.helpers';
import { MaterialTemplateService } from './material-template.service';
import { VisaCaseLookupService } from './visa-case-lookup.service';
import { VisaCaseMaterialService } from './visa-case-material.service';

export type VisaCaseMaterialFixture = {
  service: VisaCaseMaterialService;
  templateService: MaterialTemplateService;
  materialItemRepo: RepoMock;
  visaCaseRepo: RepoMock;
  familyMemberRepo: RepoMock;
  customerRepo: RepoMock;
};

/**
 * 编译 `VisaCaseMaterialService` 及其依赖的 Nest 测试模块并返回 mock 夹具。
 *
 * @returns 服务实例与各 Repository mock
 */
export async function createVisaCaseMaterialFixture(): Promise<VisaCaseMaterialFixture> {
  const materialItemRepo = createMockRepo();
  const visaCaseRepo = createMockRepo();
  const familyMemberRepo = createMockRepo();
  const customerRepo = createMockRepo();

  const templateRepo = createMockRepo();
  const templateItemRepo = createMockRepo();

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      VisaCaseMaterialService,
      VisaCaseLookupService,
      MaterialTemplateService,
      {
        provide: getRepositoryToken(VisaCaseMaterialItem),
        useValue: materialItemRepo,
      },
      { provide: getRepositoryToken(VisaCase), useValue: visaCaseRepo },
      {
        provide: getRepositoryToken(VisaCaseFamilyMember),
        useValue: familyMemberRepo,
      },
      { provide: getRepositoryToken(Customer), useValue: customerRepo },
      {
        provide: getRepositoryToken(MaterialTemplate),
        useValue: templateRepo,
      },
      {
        provide: getRepositoryToken(MaterialTemplateItem),
        useValue: templateItemRepo,
      },
    ],
  }).compile();

  return {
    service: module.get<VisaCaseMaterialService>(VisaCaseMaterialService),
    templateService: module.get<MaterialTemplateService>(
      MaterialTemplateService,
    ),
    materialItemRepo,
    visaCaseRepo,
    familyMemberRepo,
    customerRepo,
  };
}
