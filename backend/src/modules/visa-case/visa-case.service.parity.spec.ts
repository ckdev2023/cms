import { VisaCaseMemberRole } from '../../common/constants/enums';
import { VisaCaseFamilyMember } from './entities/visa-case-family-member.entity';
import {
  createQueryBuilderMock,
  createTestingContext,
  MOCK_VISA_CASE_SCOPE_ROW,
} from './visa-case.service.spec-helpers';
import { VisaCaseFamilyMemberService } from './visa-case-family-member.service';
import { VisaCaseFilePathService } from './visa-case-file-path.service';
import { VisaCaseReminderService } from './visa-case-reminder.service';

describe('VisaCaseService cross-service parity', () => {
  /**
   * 门面 VisaCaseService 与拆出的子服务在相同仓储 mock 下应返回一致结果，防止委托断裂。
   */
  it('listFamilyMembers matches VisaCaseFamilyMemberService', async () => {
    const ctx = await createTestingContext();
    const family = ctx.module.get(VisaCaseFamilyMemberService);
    ctx.visaCaseRepo.findOne.mockResolvedValueOnce(MOCK_VISA_CASE_SCOPE_ROW);
    ctx.visaCaseRepo.count.mockResolvedValue(1);
    ctx.familyMemberRepo.find.mockResolvedValue([
      {
        id: 'fm-1',
        customerId: 'cust-1',
        customer: { customerName: '山田' },
        memberRole: VisaCaseMemberRole.APPLICANT,
        isPrimary: true,
        displayNameSnapshot: '山田',
      },
    ] as VisaCaseFamilyMember[]);

    const viaFacade = await ctx.service.listFamilyMembers('vc-1', 'user-1');
    const direct = await family.listFamilyMembers('vc-1');
    expect(viaFacade).toEqual(direct);
  });

  it('findVisaReminders matches VisaCaseReminderService', async () => {
    const ctx = await createTestingContext();
    const reminder = ctx.module.get(VisaCaseReminderService);
    const qbMock = createQueryBuilderMock([[], 0]);
    ctx.visaCaseRepo.createQueryBuilder.mockReturnValue(qbMock);
    ctx.noteRepo.manager.query.mockResolvedValue([]);

    const viaFacade = await ctx.service.findVisaReminders({}, 'user-1');
    const direct = await reminder.findVisaReminders({}, 'user-1');
    expect(viaFacade).toEqual(direct);
  });

  it('findFilePathsByCustomer matches VisaCaseFilePathService', async () => {
    const ctx = await createTestingContext();
    const paths = ctx.module.get(VisaCaseFilePathService);
    ctx.customerRepo.count.mockResolvedValue(1);
    const qbMock = createQueryBuilderMock([[], 0]);
    ctx.filePathRepo.createQueryBuilder.mockReturnValue(qbMock);

    const viaFacade = await ctx.service.findFilePathsByCustomer('cust-1', {});
    const direct = await paths.findFilePathsByCustomer('cust-1', {});
    expect(viaFacade).toEqual(direct);
  });
});
