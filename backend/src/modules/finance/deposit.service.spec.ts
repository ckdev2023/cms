import { BadRequestException, NotFoundException } from '@nestjs/common';

import {
  DepositTransactionType,
  PaymentMethod,
} from '../../common/constants/enums';
import {
  adjustDeposit,
  buildDepositAccount,
  buildDepositInvoice,
  buildDepositPaymentAllocation,
  buildDepositTransaction,
  createDepositContext,
  type DepositServiceContext,
  INVALID_OFFSET_STATUSES,
  mockReloadedTransaction,
  offsetDeposit,
  rechargeDeposit,
  refundDeposit,
} from './deposit.service.spec-helpers';
import { DepositAccount } from './entities/deposit-account.entity';
import { DepositTransaction } from './entities/deposit-transaction.entity';
import {
  createMockQueryBuilder,
  MOCK_CUSTOMER_ID,
  toSelectQueryBuilder,
} from './payment.service.spec-helpers';

function createContext(): DepositServiceContext {
  return createDepositContext();
}

describe('DepositService setup', () => {
  it('creates the service instance', () => {
    expect(createContext().service).toBeDefined();
  });
});

describe('DepositService recharge', () => {
  it('creates an account when absent and records the recharge transaction', async () => {
    const { service, txnRepo, mockManager, mockQueryRunner } = createContext();
    mockManager.findOne.mockResolvedValueOnce(null);
    mockManager.save
      .mockResolvedValueOnce(buildDepositAccount({ id: 'da-new', balance: 0 }))
      .mockResolvedValueOnce(
        buildDepositAccount({ id: 'da-new', balance: 10000 }),
      )
      .mockResolvedValueOnce(buildDepositTransaction({ id: 'dt-new' }));
    mockReloadedTransaction(txnRepo, { id: 'dt-new' });

    const result = await rechargeDeposit(service, {
      paymentMethod: PaymentMethod.BANK,
    });

    expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('recharges an existing account and increases the balance', async () => {
    const { service, txnRepo, mockManager, mockQueryRunner } = createContext();
    mockManager.findOne.mockResolvedValueOnce(
      buildDepositAccount({ balance: 50000 }),
    );
    mockReloadedTransaction(txnRepo, { amount: 20000, balanceAfter: 70000 });

    await rechargeDeposit(service, { amount: 20000 });

    expect(mockManager.save).toHaveBeenCalledWith(
      DepositAccount,
      expect.objectContaining({ balance: 70000 }),
    );
    expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
  });

  it('includes the payment method in the saved remark', async () => {
    const { service, txnRepo, mockManager } = createContext();
    mockManager.findOne.mockResolvedValueOnce(buildDepositAccount());
    mockReloadedTransaction(txnRepo);

    await rechargeDeposit(service, {
      amount: 5000,
      paymentMethod: PaymentMethod.CASH,
      remark: 'テスト入金',
    });

    expect(mockManager.create).toHaveBeenCalledWith(
      DepositTransaction,
      expect.objectContaining({
        remark: 'CASH | テスト入金',
        transactionType: DepositTransactionType.RECHARGE,
      }),
    );
  });

  it('keeps decimal precision stable during recharge', async () => {
    const { service, txnRepo, mockManager } = createContext();
    mockManager.findOne.mockResolvedValueOnce(
      buildDepositAccount({ balance: 100.33 }),
    );
    mockReloadedTransaction(txnRepo);

    await rechargeDeposit(service, { amount: 99.67 });

    expect(mockManager.save).toHaveBeenCalledWith(
      DepositAccount,
      expect.objectContaining({ balance: 200 }),
    );
  });
});

describe('DepositService offset success', () => {
  it('offsets against an invoice and updates the account balance', async () => {
    const { service, txnRepo, mockManager, mockQueryRunner } = createContext();
    mockManager.findOne
      .mockResolvedValueOnce(buildDepositAccount({ balance: 50000 }))
      .mockResolvedValueOnce(buildDepositInvoice({ paymentAllocations: [] }))
      .mockResolvedValueOnce(buildDepositInvoice({ paymentAllocations: [] }));
    mockReloadedTransaction(txnRepo, {
      transactionType: DepositTransactionType.OFFSET,
      amount: 30000,
      balanceAfter: 20000,
      relatedInvoiceId: 'inv-uuid-001',
    });

    const result = await offsetDeposit(service, { amount: 30000 });

    expect(mockManager.save).toHaveBeenCalledWith(
      DepositAccount,
      expect.objectContaining({ balance: 20000 }),
    );
    expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    expect(result).toBeDefined();
  });
});

describe('DepositService offset validation', () => {
  it('rejects when the deposit balance is insufficient', async () => {
    const { service, mockManager, mockQueryRunner } = createContext();
    mockManager.findOne.mockResolvedValueOnce(
      buildDepositAccount({ balance: 5000 }),
    );

    await expect(offsetDeposit(service)).rejects.toThrow(BadRequestException);
    expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
  });

  it('rejects when the deposit account does not exist', async () => {
    const { service, mockManager } = createContext();
    mockManager.findOne.mockResolvedValueOnce(null);

    await expect(offsetDeposit(service, { amount: 1000 })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('rejects when the target invoice does not exist', async () => {
    const { service, mockManager } = createContext();
    mockManager.findOne
      .mockResolvedValueOnce(buildDepositAccount({ balance: 50000 }))
      .mockResolvedValueOnce(null);

    await expect(
      offsetDeposit(service, { invoiceId: 'nonexistent', amount: 1000 }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects when the invoice belongs to another customer', async () => {
    const { service, mockManager } = createContext();
    mockManager.findOne
      .mockResolvedValueOnce(buildDepositAccount({ balance: 50000 }))
      .mockResolvedValueOnce(
        buildDepositInvoice({ customerId: 'other-customer' }),
      );

    await expect(offsetDeposit(service, { amount: 1000 })).rejects.toThrow(
      BadRequestException,
    );
  });

  it.each(INVALID_OFFSET_STATUSES)(
    'rejects invoice status %s for offset',
    async (status) => {
      const { service, mockManager } = createContext();
      mockManager.findOne
        .mockResolvedValueOnce(buildDepositAccount({ balance: 50000 }))
        .mockResolvedValueOnce(
          buildDepositInvoice({ status, paymentAllocations: [] }),
        );

      await expect(offsetDeposit(service, { amount: 1000 })).rejects.toThrow(
        BadRequestException,
      );
    },
  );

  it('rejects when the offset exceeds the invoice remaining amount', async () => {
    const { service, mockManager } = createContext();
    mockManager.findOne
      .mockResolvedValueOnce(buildDepositAccount({ balance: 50000 }))
      .mockResolvedValueOnce(
        buildDepositInvoice({
          totalAmount: 10000,
          paymentAllocations: [
            buildDepositPaymentAllocation({ allocatedAmount: 8000 }),
          ],
        }),
      );

    await expect(offsetDeposit(service, { amount: 5000 })).rejects.toThrow(
      BadRequestException,
    );
  });
});

describe('DepositService refund', () => {
  it('refunds and decreases the balance', async () => {
    const { service, txnRepo, mockManager, mockQueryRunner } = createContext();
    mockManager.findOne.mockResolvedValueOnce(
      buildDepositAccount({ balance: 30000 }),
    );
    mockReloadedTransaction(txnRepo, {
      transactionType: DepositTransactionType.REFUND,
      amount: 10000,
      balanceAfter: 20000,
    });

    await refundDeposit(service, { reason: '顧客都合による返金' });

    expect(mockManager.save).toHaveBeenCalledWith(
      DepositAccount,
      expect.objectContaining({ balance: 20000 }),
    );
    expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
  });

  it('combines the reason and remark when both are provided', async () => {
    const { service, txnRepo, mockManager } = createContext();
    mockManager.findOne.mockResolvedValueOnce(
      buildDepositAccount({ balance: 30000 }),
    );
    mockReloadedTransaction(txnRepo);

    await refundDeposit(service, {
      amount: 5000,
      reason: '契約解除',
      remark: '追加メモ',
    });

    expect(mockManager.create).toHaveBeenCalledWith(
      DepositTransaction,
      expect.objectContaining({ remark: '契約解除 | 追加メモ' }),
    );
  });

  it('rejects refunds that exceed the current balance', async () => {
    const { service, mockManager } = createContext();
    mockManager.findOne.mockResolvedValueOnce(
      buildDepositAccount({ balance: 3000 }),
    );

    await expect(refundDeposit(service)).rejects.toThrow(BadRequestException);
  });

  it('rejects refunds when the account does not exist', async () => {
    const { service, mockManager } = createContext();
    mockManager.findOne.mockResolvedValueOnce(null);

    await expect(refundDeposit(service, { amount: 1000 })).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('DepositService adjustment', () => {
  it('supports positive adjustments', async () => {
    const { service, txnRepo, mockManager, mockQueryRunner } = createContext();
    mockManager.findOne.mockResolvedValueOnce(
      buildDepositAccount({ balance: 10000 }),
    );
    mockReloadedTransaction(txnRepo, {
      transactionType: DepositTransactionType.ADJUSTMENT,
      amount: 5000,
      balanceAfter: 15000,
    });

    await adjustDeposit(service, { amount: 5000, reason: 'システム補正' });

    expect(mockManager.save).toHaveBeenCalledWith(
      DepositAccount,
      expect.objectContaining({ balance: 15000 }),
    );
    expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
  });

  it('supports negative adjustments that keep the balance non-negative', async () => {
    const { service, txnRepo, mockManager } = createContext();
    mockManager.findOne.mockResolvedValueOnce(
      buildDepositAccount({ balance: 10000 }),
    );
    mockReloadedTransaction(txnRepo);

    await adjustDeposit(service, { amount: -3000, reason: '過剰チャージ修正' });

    expect(mockManager.save).toHaveBeenCalledWith(
      DepositAccount,
      expect.objectContaining({ balance: 7000 }),
    );
  });

  it('rejects zero-amount adjustments', async () => {
    const { service } = createContext();

    await expect(adjustDeposit(service, { amount: 0 })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects adjustments that would make the balance negative', async () => {
    const { service, mockManager } = createContext();
    mockManager.findOne.mockResolvedValueOnce(
      buildDepositAccount({ balance: 5000 }),
    );

    await expect(adjustDeposit(service, { amount: -10000 })).rejects.toThrow(
      BadRequestException,
    );
  });
});

describe('DepositService account queries', () => {
  it('returns paginated account results', async () => {
    const { service, accountRepo } = createContext();
    const qb = createMockQueryBuilder<DepositAccount>({
      items: [buildDepositAccount()],
    });
    accountRepo.createQueryBuilder.mockReturnValue(toSelectQueryBuilder(qb));

    const result = await service.findAllAccounts({ page: 1, pageSize: 20 });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
  });

  it('applies keyword and customer filters to account queries', async () => {
    const { service, accountRepo } = createContext();
    const qb = createMockQueryBuilder<DepositAccount>();
    accountRepo.createQueryBuilder.mockReturnValue(toSelectQueryBuilder(qb));

    await service.findAllAccounts({
      keyword: 'テスト',
      customerId: MOCK_CUSTOMER_ID,
    });

    expect(qb.andWhere).toHaveBeenCalled();
    expect(qb.andWhere).toHaveBeenCalledWith('da.customerId = :customerId', {
      customerId: MOCK_CUSTOMER_ID,
    });
  });

  it('applies the hasBalance filter to account queries', async () => {
    const { service, accountRepo } = createContext();
    const qb = createMockQueryBuilder<DepositAccount>();
    accountRepo.createQueryBuilder.mockReturnValue(toSelectQueryBuilder(qb));

    await service.findAllAccounts({ hasBalance: true });

    expect(qb.andWhere).toHaveBeenCalledWith('da.balance > 0');
  });

  it('returns account detail by id and by customer', async () => {
    const { service, accountRepo } = createContext();
    accountRepo.findOne
      .mockResolvedValueOnce(buildDepositAccount())
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(buildDepositAccount())
      .mockResolvedValueOnce(null);

    await expect(service.findAccountById('da-uuid-001')).resolves.toMatchObject(
      {
        customerId: MOCK_CUSTOMER_ID,
      },
    );
    await expect(service.findAccountById('missing')).rejects.toThrow(
      NotFoundException,
    );

    const account = await service.findAccountByCustomer(MOCK_CUSTOMER_ID);
    const missing = await service.findAccountByCustomer('nonexistent');

    expect(account?.customerId).toBe(MOCK_CUSTOMER_ID);
    expect(missing).toBeNull();
  });

  it('returns aggregated account summary values', async () => {
    const { service, accountRepo } = createContext();
    const qb = createMockQueryBuilder<
      DepositAccount,
      { totalAccounts: string; totalBalance: string; activeAccounts: string }
    >({
      rawRow: {
        totalAccounts: '10',
        totalBalance: '500000',
        activeAccounts: '7',
      },
    });
    accountRepo.createQueryBuilder.mockReturnValue(toSelectQueryBuilder(qb));

    const result = await service.getAccountSummary();

    expect(result.totalAccounts).toBe('10');
    expect(result.totalBalance).toBe('500000');
    expect(result.activeAccounts).toBe('7');
  });
});

describe('DepositService transaction queries', () => {
  it('returns paginated transaction results', async () => {
    const { service, txnRepo } = createContext();
    const qb = createMockQueryBuilder<DepositTransaction>({
      items: [buildDepositTransaction()],
    });
    txnRepo.createQueryBuilder.mockReturnValue(toSelectQueryBuilder(qb));

    const result = await service.findAllTransactions({ page: 1, pageSize: 20 });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('applies transaction type and keyword filters', async () => {
    const { service, txnRepo } = createContext();
    const qb = createMockQueryBuilder<DepositTransaction>();
    txnRepo.createQueryBuilder.mockReturnValue(toSelectQueryBuilder(qb));

    await service.findAllTransactions({
      transactionType: DepositTransactionType.RECHARGE,
      keyword: 'INV',
    });

    expect(qb.andWhere).toHaveBeenCalledWith(
      'dt.transactionType = :transactionType',
      { transactionType: DepositTransactionType.RECHARGE },
    );
    expect(qb.andWhere).toHaveBeenCalled();
  });

  it('applies date range filters to transaction queries', async () => {
    const { service, txnRepo } = createContext();
    const qb = createMockQueryBuilder<DepositTransaction>();
    txnRepo.createQueryBuilder.mockReturnValue(toSelectQueryBuilder(qb));

    await service.findAllTransactions({
      createdFrom: '2026-01-01',
      createdTo: '2026-12-31',
    });

    expect(qb.andWhere).toHaveBeenCalledWith('dt.createdAt >= :createdFrom', {
      createdFrom: '2026-01-01',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('dt.createdAt <= :createdTo', {
      createdTo: '2026-12-31',
    });
  });
});

describe('DepositService numeric edge cases', () => {
  it('handles floating point recharge sums like 0.1 + 0.2', async () => {
    const { service, txnRepo, mockManager } = createContext();
    mockManager.findOne.mockResolvedValueOnce(
      buildDepositAccount({ balance: 0.1 }),
    );
    mockReloadedTransaction(txnRepo);

    await rechargeDeposit(service, { amount: 0.2 });

    expect(mockManager.save).toHaveBeenCalledWith(
      DepositAccount,
      expect.objectContaining({ balance: 0.3 }),
    );
  });

  it('handles large amount recharges without losing precision', async () => {
    const { service, txnRepo, mockManager } = createContext();
    mockManager.findOne.mockResolvedValueOnce(
      buildDepositAccount({ balance: 999999999.99 }),
    );
    mockReloadedTransaction(txnRepo);

    await rechargeDeposit(service, { amount: 0.01 });

    expect(mockManager.save).toHaveBeenCalledWith(
      DepositAccount,
      expect.objectContaining({ balance: 1000000000 }),
    );
  });
});

describe('DepositService transaction safety', () => {
  it('rolls back recharge failures', async () => {
    const { service, mockManager, mockQueryRunner } = createContext();
    mockManager.findOne.mockResolvedValueOnce(buildDepositAccount());
    mockManager.save.mockRejectedValueOnce(new Error('DB error'));

    await expect(rechargeDeposit(service, { amount: 1000 })).rejects.toThrow(
      'DB error',
    );

    expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(mockQueryRunner.release).toHaveBeenCalled();
  });

  it('rolls back offset failures after the account update starts', async () => {
    const { service, mockManager, mockQueryRunner } = createContext();
    mockManager.findOne
      .mockResolvedValueOnce(buildDepositAccount({ balance: 50000 }))
      .mockResolvedValueOnce(buildDepositInvoice({ paymentAllocations: [] }));
    mockManager.save
      .mockResolvedValueOnce(buildDepositAccount())
      .mockRejectedValueOnce(new Error('DB error'));

    await expect(offsetDeposit(service, { amount: 1000 })).rejects.toThrow(
      'DB error',
    );

    expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(mockQueryRunner.release).toHaveBeenCalled();
  });

  it('always releases the query runner when a transaction fails early', async () => {
    const { service, mockManager, mockQueryRunner } = createContext();
    mockManager.findOne.mockRejectedValueOnce(new Error('Connection lost'));

    await expect(refundDeposit(service, { amount: 1000 })).rejects.toThrow();

    expect(mockQueryRunner.release).toHaveBeenCalled();
  });
});
