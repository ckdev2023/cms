import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import { MaterialStatus, MonthlyStatus } from '../../common/constants/enums';
import type { TaxPeriod } from './entities';
import {
  createMockContract,
  createMockPeriod,
  createTaxQueryBuilderMock,
  createTaxServiceContext,
} from './tax.service.spec-helpers';

describe('TaxService createPeriod', () => {
  it('creates a period with default statuses', async () => {
    const { service, contractRepo, periodRepo } = createTaxServiceContext();
    const mockContract = createMockContract();
    contractRepo.findOne.mockResolvedValue(mockContract);
    periodRepo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(createMockPeriod({ id: 'period-new' }));
    periodRepo.save.mockResolvedValue(createMockPeriod({ id: 'period-new' }));

    const result = await service.createPeriod(
      'contract-1',
      { periodYm: '2026-04' },
      'user-1',
    );

    expect(periodRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        taxContractId: 'contract-1',
        customerId: 'customer-1',
        periodYm: '2026-04',
        monthlyStatus: MonthlyStatus.NOT_STARTED,
        materialStatus: MaterialStatus.NOT_RECEIVED,
      }),
    );
    expect(result.id).toBe('period-new');
  });

  it('creates a period with declaration deadline and rejects duplicates', async () => {
    const { service, contractRepo, periodRepo } = createTaxServiceContext();
    const mockContract = createMockContract();
    contractRepo.findOne.mockResolvedValue(mockContract);
    periodRepo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(createMockPeriod({ id: 'period-new' }))
      .mockResolvedValueOnce(createMockPeriod());
    periodRepo.save.mockResolvedValue(createMockPeriod({ id: 'period-new' }));

    await service.createPeriod(
      'contract-1',
      { periodYm: '2026-04', declarationDeadline: '2026-05-10' },
      'user-1',
    );

    expect(periodRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        declarationDeadline: new Date('2026-05-10'),
      }),
    );
    await expect(
      service.createPeriod('contract-1', { periodYm: '2026-04' }, 'user-1'),
    ).rejects.toThrow(ConflictException);
  });
});

describe('TaxService period listing', () => {
  it('lists periods with pagination and filters', async () => {
    const { service, periodRepo } = createTaxServiceContext();
    const qb = createTaxQueryBuilderMock([createMockPeriod()], 1);
    periodRepo.createQueryBuilder.mockReturnValue(qb as never);

    const result = await service.findPeriods('contract-1', {
      page: 1,
      pageSize: 20,
      monthlyStatus: MonthlyStatus.IN_PROGRESS,
      periodYmFrom: '2026-04',
      periodYmTo: '2026-12',
    });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(qb.where).toHaveBeenCalledWith('tp.taxContractId = :contractId', {
      contractId: 'contract-1',
    });
    expect(qb.andWhere).toHaveBeenCalledWith(
      'tp.monthlyStatus = :monthlyStatus',
      {
        monthlyStatus: MonthlyStatus.IN_PROGRESS,
      },
    );
    expect(qb.andWhere).toHaveBeenCalledWith('tp.periodYm >= :periodYmFrom', {
      periodYmFrom: '2026-04',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('tp.periodYm <= :periodYmTo', {
      periodYmTo: '2026-12',
    });
  });

  it('loads a single period with children and throws when missing', async () => {
    const { service, periodRepo } = createTaxServiceContext();
    const mockPeriod = createMockPeriod();
    periodRepo.findOne
      .mockResolvedValueOnce(mockPeriod)
      .mockResolvedValueOnce(null);

    const result = await service.findOnePeriod('period-1');

    expect(result.id).toBe('period-1');
    await expect(service.findOnePeriod('missing')).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('TaxService period mutations', () => {
  it('updates monthly status and removes child records before soft delete', async () => {
    const { service, periodRepo, documentRepo, workItemRepo } =
      createTaxServiceContext();
    const mockPeriod = createMockPeriod();
    periodRepo.findOne.mockResolvedValue(mockPeriod);
    periodRepo.save.mockResolvedValue({
      ...mockPeriod,
      monthlyStatus: MonthlyStatus.IN_PROGRESS,
    });

    await service.updatePeriodStatus(
      'period-1',
      MonthlyStatus.IN_PROGRESS,
      'user-1',
    );
    await service.removePeriod('period-1');

    expect(periodRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        monthlyStatus: MonthlyStatus.IN_PROGRESS,
      }),
    );
    expect(documentRepo.delete).toHaveBeenCalledWith({
      taxPeriodId: 'period-1',
    });
    expect(workItemRepo.delete).toHaveBeenCalledWith({
      taxPeriodId: 'period-1',
    });
    expect(periodRepo.softRemove).toHaveBeenCalledWith(mockPeriod);
  });
});

describe('TaxService generatePeriods', () => {
  it('generates missing periods and skips existing ones', async () => {
    const { service, contractRepo, periodRepo } = createTaxServiceContext();
    const mockContract = createMockContract();
    contractRepo.findOne.mockResolvedValue(mockContract);
    periodRepo.find
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { periodYm: '2026-04' },
        { periodYm: '2026-05' },
      ] as TaxPeriod[]);

    const created = await service.generatePeriods(
      'contract-1',
      { startYm: '2026-04', endYm: '2026-06' },
      'user-1',
    );
    const skipped = await service.generatePeriods(
      'contract-1',
      { startYm: '2026-04', endYm: '2026-06' },
      'user-1',
    );

    expect(created).toHaveLength(3);
    expect(skipped).toHaveLength(1);
    expect(periodRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ periodYm: '2026-06' }),
    );
  });

  it('applies deadlineDay and returns empty when all periods exist', async () => {
    const { service, contractRepo, periodRepo } = createTaxServiceContext();
    const mockContract = createMockContract();
    contractRepo.findOne.mockResolvedValue(mockContract);
    periodRepo.find
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { periodYm: '2026-04' },
        { periodYm: '2026-05' },
      ] as TaxPeriod[]);

    await service.generatePeriods(
      'contract-1',
      { startYm: '2026-04', endYm: '2026-04', deadlineDay: 10 },
      'user-1',
    );
    const result = await service.generatePeriods(
      'contract-1',
      { startYm: '2026-04', endYm: '2026-05' },
      'user-1',
    );

    expect(periodRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        declarationDeadline: new Date(2026, 4, 10),
      }),
    );
    expect(result).toEqual([]);
    expect(periodRepo.save).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid generation ranges', async () => {
    const { service, contractRepo } = createTaxServiceContext();
    contractRepo.findOne.mockResolvedValue(createMockContract());

    await expect(
      service.generatePeriods(
        'contract-1',
        { startYm: '2027-01', endYm: '2026-01' },
        'user-1',
      ),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.generatePeriods(
        'contract-1',
        { startYm: '2026-01', endYm: '2029-12' },
        'user-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
