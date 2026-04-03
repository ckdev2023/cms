import { AdminCaseStatus } from '../../common/constants/enums';
import {
  applyAdminCaseInterviewQueryOptions,
  applyAdminCaseListQueryOptions,
} from './admin-case.query-helper';

type MockQueryBuilder = {
  andWhere: jest.MockedFunction<
    (
      condition: unknown,
      parameters?: Record<string, unknown>,
    ) => MockQueryBuilder
  >;
  orderBy: jest.MockedFunction<
    (sort: string, order?: 'ASC' | 'DESC') => MockQueryBuilder
  >;
  skip: jest.MockedFunction<(count: number) => MockQueryBuilder>;
  take: jest.MockedFunction<(count: number) => MockQueryBuilder>;
};

function createMockQueryBuilder(): MockQueryBuilder {
  const qb = {} as MockQueryBuilder;

  qb.andWhere = jest.fn().mockImplementation(() => qb);
  qb.orderBy = jest.fn().mockImplementation(() => qb);
  qb.skip = jest.fn().mockImplementation(() => qb);
  qb.take = jest.fn().mockImplementation(() => qb);

  return qb;
}

function registerListQueryOptionTests(): void {
  describe('applyAdminCaseListQueryOptions', () => {
    it('should apply all list filters, sorting, and pagination', () => {
      const qb = createMockQueryBuilder();

      applyAdminCaseListQueryOptions(qb as never, {
        keyword: '田中',
        status: AdminCaseStatus.DRAFT,
        customerId: 'customer-1',
        ownerUserId: 'user-1',
        expireDateFrom: '2026-01-01',
        expireDateTo: '2026-12-31',
        sortBy: 'caseName',
        sortOrder: 'ASC',
        page: 2,
        pageSize: 10,
      });

      expect(qb.andWhere).toHaveBeenNthCalledWith(1, expect.anything());
      expect(qb.andWhere).toHaveBeenNthCalledWith(2, 'ac.status = :status', {
        status: AdminCaseStatus.DRAFT,
      });
      expect(qb.andWhere).toHaveBeenNthCalledWith(
        3,
        'ac.customerId = :customerId',
        {
          customerId: 'customer-1',
        },
      );
      expect(qb.andWhere).toHaveBeenNthCalledWith(
        4,
        'ac.ownerUserId = :ownerUserId',
        {
          ownerUserId: 'user-1',
        },
      );
      expect(qb.andWhere).toHaveBeenNthCalledWith(5, 'ac.expireDate >= :from', {
        from: '2026-01-01',
      });
      expect(qb.andWhere).toHaveBeenNthCalledWith(6, 'ac.expireDate <= :to', {
        to: '2026-12-31',
      });
      expect(qb.orderBy).toHaveBeenCalledWith('ac.caseName', 'ASC');
      expect(qb.skip).toHaveBeenCalledWith(10);
      expect(qb.take).toHaveBeenCalledWith(10);
    });

    it('should fall back to default sorting and pagination', () => {
      const qb = createMockQueryBuilder();

      applyAdminCaseListQueryOptions(qb as never, {
        sortBy: 'invalid-field',
      });

      expect(qb.orderBy).toHaveBeenCalledWith('ac.createdAt', 'DESC');
      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(20);
    });
  });
}

function registerInterviewQueryOptionTests(): void {
  describe('applyAdminCaseInterviewQueryOptions', () => {
    it('should apply interview filters, sorting, and pagination', () => {
      const qb = createMockQueryBuilder();

      applyAdminCaseInterviewQueryOptions(qb as never, {
        dateFrom: '2026-01-01',
        dateTo: '2026-12-31',
        sortOrder: 'ASC',
        page: 3,
        pageSize: 5,
      });

      expect(qb.andWhere).toHaveBeenNthCalledWith(
        1,
        'iv.interviewDate >= :dateFrom',
        {
          dateFrom: '2026-01-01',
        },
      );
      expect(qb.andWhere).toHaveBeenNthCalledWith(
        2,
        'iv.interviewDate <= :dateTo',
        {
          dateTo: '2026-12-31',
        },
      );
      expect(qb.orderBy).toHaveBeenCalledWith('iv.interviewDate', 'ASC');
      expect(qb.skip).toHaveBeenCalledWith(10);
      expect(qb.take).toHaveBeenCalledWith(5);
    });
  });
}

describe('admin-case query helper', () => {
  registerListQueryOptionTests();
  registerInterviewQueryOptionTests();
});
