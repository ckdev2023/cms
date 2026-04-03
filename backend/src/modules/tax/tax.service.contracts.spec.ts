import { BadRequestException, NotFoundException } from '@nestjs/common';

import { TaxContractStatus } from '../../common/constants/enums';
import {
  createMockContract,
  createTaxQueryBuilderMock,
  createTaxServiceContext,
} from './tax.service.spec-helpers';

describe('TaxService contract create', () => {
  it('creates a contract with default ACTIVE status', async () => {
    const { service, contractRepo } = createTaxServiceContext();
    const mockContract = createMockContract({ id: 'contract-new' });
    contractRepo.save.mockResolvedValue(mockContract);
    contractRepo.findOne.mockResolvedValue(mockContract);

    const result = await service.create(
      {
        customerId: 'customer-1',
        contractName: 'テスト契約',
        startDate: '2026-04-01',
      },
      'user-1',
    );

    expect(contractRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'customer-1',
        contractName: 'テスト契約',
        contractStatus: TaxContractStatus.ACTIVE,
        createdBy: 'user-1',
      }),
    );
    expect(result.id).toBe('contract-new');
  });

  it('creates a contract with explicit status and monthly fee', async () => {
    const { service, contractRepo } = createTaxServiceContext();
    const mockContract = createMockContract({
      id: 'contract-new',
      contractStatus: TaxContractStatus.EXPIRED,
      monthlyFee: 80000,
    });
    contractRepo.save.mockResolvedValue(mockContract);
    contractRepo.findOne.mockResolvedValue(mockContract);

    await service.create(
      {
        customerId: 'customer-1',
        contractName: 'テスト契約',
        startDate: '2026-04-01',
        contractStatus: TaxContractStatus.EXPIRED,
        monthlyFee: 80000,
      },
      'user-1',
    );

    expect(contractRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        contractStatus: TaxContractStatus.EXPIRED,
        monthlyFee: 80000,
      }),
    );
  });
});

describe('TaxService contract read and update', () => {
  it('loads one contract with relations and throws when missing', async () => {
    const { service, contractRepo } = createTaxServiceContext();
    const mockContract = createMockContract();
    contractRepo.findOne
      .mockResolvedValueOnce(mockContract)
      .mockResolvedValueOnce(null);

    const result = await service.findOne('contract-1');

    expect(result.id).toBe('contract-1');
    expect(contractRepo.findOne).toHaveBeenNthCalledWith(1, {
      where: { id: 'contract-1' },
      relations: ['customer', 'owner', 'periods'],
    });
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('updates contract fields including zero fee and null end date', async () => {
    const { service, contractRepo } = createTaxServiceContext();
    const contract = createMockContract({ monthlyFee: 50000 });
    const updated = {
      ...contract,
      contractName: '更新契約',
      monthlyFee: 0,
      endDate: null,
    };
    contractRepo.findOne
      .mockResolvedValueOnce(contract)
      .mockResolvedValueOnce(updated);
    contractRepo.save.mockResolvedValue(updated);

    const result = await service.update(
      'contract-1',
      {
        contractName: '更新契約',
        monthlyFee: 0,
        endDate: null,
      },
      'user-2',
    );

    expect(result.contractName).toBe('更新契約');
    expect(contractRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        contractName: '更新契約',
        monthlyFee: 0,
        endDate: null,
      }),
    );
  });

  it('soft-deletes a contract and throws when removing a missing one', async () => {
    const { service, contractRepo } = createTaxServiceContext();
    const mockContract = createMockContract();
    contractRepo.findOne
      .mockResolvedValueOnce(mockContract)
      .mockResolvedValueOnce(null);

    await service.remove('contract-1');
    expect(contractRepo.softRemove).toHaveBeenCalledWith(mockContract);

    await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
  });
});

describe('TaxService valid contract status transitions', () => {
  it('allows valid status transitions', async () => {
    const { service, contractRepo } = createTaxServiceContext();
    contractRepo.findOne
      .mockResolvedValueOnce(
        createMockContract({
          contractStatus: TaxContractStatus.ACTIVE,
        }),
      )
      .mockResolvedValueOnce(
        createMockContract({
          contractStatus: TaxContractStatus.EXPIRED,
        }),
      )
      .mockResolvedValueOnce(
        createMockContract({
          contractStatus: TaxContractStatus.ACTIVE,
        }),
      )
      .mockResolvedValueOnce({
        ...createMockContract({
          contractStatus: TaxContractStatus.ACTIVE,
        }),
        contractStatus: TaxContractStatus.TERMINATED,
      })
      .mockResolvedValueOnce(
        createMockContract({
          contractStatus: TaxContractStatus.EXPIRED,
        }),
      )
      .mockResolvedValueOnce({
        ...createMockContract({
          contractStatus: TaxContractStatus.EXPIRED,
        }),
        contractStatus: TaxContractStatus.ACTIVE,
      });

    await service.updateStatus(
      'contract-1',
      TaxContractStatus.EXPIRED,
      'user-1',
    );
    await service.updateStatus(
      'contract-1',
      TaxContractStatus.TERMINATED,
      'user-1',
    );
    await service.updateStatus(
      'contract-1',
      TaxContractStatus.ACTIVE,
      'user-1',
    );

    expect(contractRepo.save).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ contractStatus: TaxContractStatus.EXPIRED }),
    );
    expect(contractRepo.save).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ contractStatus: TaxContractStatus.TERMINATED }),
    );
    expect(contractRepo.save).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ contractStatus: TaxContractStatus.ACTIVE }),
    );
  });
});

describe('TaxService invalid contract status transitions', () => {
  it('rejects invalid contract status transitions', async () => {
    const { service, contractRepo } = createTaxServiceContext();
    contractRepo.findOne
      .mockResolvedValueOnce(
        createMockContract({ contractStatus: TaxContractStatus.TERMINATED }),
      )
      .mockResolvedValueOnce(
        createMockContract({ contractStatus: TaxContractStatus.ACTIVE }),
      );

    await expect(
      service.updateStatus('contract-1', TaxContractStatus.ACTIVE, 'user-1'),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.updateStatus('contract-1', TaxContractStatus.ACTIVE, 'user-1'),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('TaxService available contract transitions', () => {
  it('returns available transitions by status', () => {
    const { service } = createTaxServiceContext();

    expect(service.getAvailableTransitions(TaxContractStatus.ACTIVE)).toEqual([
      TaxContractStatus.EXPIRED,
      TaxContractStatus.TERMINATED,
    ]);
    expect(service.getAvailableTransitions(TaxContractStatus.EXPIRED)).toEqual([
      TaxContractStatus.ACTIVE,
      TaxContractStatus.TERMINATED,
    ]);
    expect(
      service.getAvailableTransitions(TaxContractStatus.TERMINATED),
    ).toEqual([]);
  });
});

describe('TaxService contract listing', () => {
  it('builds contract list queries with pagination defaults and filters', async () => {
    const { service, contractRepo } = createTaxServiceContext();
    const qb = createTaxQueryBuilderMock([createMockContract()], 1);
    contractRepo.createQueryBuilder.mockReturnValue(qb as never);

    const result = await service.findAll({
      keyword: 'テスト',
      contractStatus: TaxContractStatus.ACTIVE,
    });

    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      id: 'contract-1',
      customerName: 'テスト顧客',
      ownerName: '担当者A',
    });
    expect(qb.andWhere).toHaveBeenCalledWith(
      'tc.contractStatus = :contractStatus',
      { contractStatus: TaxContractStatus.ACTIVE },
    );
    expect(qb.skip).toHaveBeenCalledWith(0);
    expect(qb.take).toHaveBeenCalledWith(20);
  });

  it('delegates customer filtering through findByCustomer', async () => {
    const { service, contractRepo } = createTaxServiceContext();
    const qb = createTaxQueryBuilderMock([], 0);
    contractRepo.createQueryBuilder.mockReturnValue(qb as never);

    await service.findByCustomer('customer-1', { page: 1 });

    expect(qb.andWhere).toHaveBeenCalledWith('tc.customerId = :customerId', {
      customerId: 'customer-1',
    });
  });
});
