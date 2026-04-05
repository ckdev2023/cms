import type { SelectQueryBuilder } from 'typeorm';

import { FamilyLinkMode, VisaCaseStatus } from '../../common/constants/enums';
import type { ResolvedVisaDataScope } from '../visa-case/visa-case-data-scope.types';
import { applyCustomerListFiltersToQueryBuilder } from './customer-list.query';
import type { QueryCustomerDto } from './dto/query-customer.dto';
import type { Customer } from './entities/customer.entity';

type QueryBuilderMock = {
  andWhere: jest.Mock;
  setParameter: jest.Mock;
  asQb: () => SelectQueryBuilder<Customer>;
};

/** 与 `applyCustomerListVisaCaseTypeKeywordFilter` 内 EXISTS 片段保持一致，用于契约断言 */
const VISA_CASE_TYPE_EXISTS_SQL = `EXISTS (
        SELECT 1 FROM visa_cases vct
        WHERE vct.deleted_at IS NULL
          AND vct.customer_id = c.id
          AND vct.case_type ILIKE :vctCaseTypeKw
      )`;

/**
 * 构造用于断言客户列表筛选条件的 QueryBuilder 替身。
 *
 * @returns 独立 mock 函数与可传入筛选器的 QueryBuilder 替身
 */
function createQueryBuilderMock(): QueryBuilderMock {
  const setParameter = jest.fn().mockReturnThis();
  const andWhere = jest.fn().mockReturnThis();
  return {
    andWhere,
    setParameter,
    asQb: () =>
      ({
        andWhere,
        setParameter,
      }) as unknown as SelectQueryBuilder<Customer>,
  };
}

describe('applyCustomerListFiltersToQueryBuilder · wechat and lineId', () => {
  const todayStr = '2026-04-04';
  const supplementLogCaseIds: string[] = [];
  const resolvedAll: ResolvedVisaDataScope = { mode: 'all' };

  it('applies wechatId and lineId as case-insensitive partial matches', () => {
    const { andWhere, asQb } = createQueryBuilderMock();
    const query = {
      wechatId: 'wx_demo',
      lineId: 'line_user',
    } as QueryCustomerDto;

    applyCustomerListFiltersToQueryBuilder(
      asQb(),
      query,
      todayStr,
      supplementLogCaseIds,
      resolvedAll,
    );

    expect(andWhere).toHaveBeenCalledWith('c.wechatId ILIKE :wechatIdFilter', {
      wechatIdFilter: '%wx_demo%',
    });
    expect(andWhere).toHaveBeenCalledWith('c.lineId ILIKE :lineIdFilter', {
      lineIdFilter: '%line_user%',
    });
  });

  it('trims whitespace on dedicated wechatId and lineId filters', () => {
    const { andWhere, asQb } = createQueryBuilderMock();
    const query = {
      wechatId: '  abc  ',
      lineId: '\tline\t',
    } as QueryCustomerDto;

    applyCustomerListFiltersToQueryBuilder(
      asQb(),
      query,
      todayStr,
      supplementLogCaseIds,
      resolvedAll,
    );

    expect(andWhere).toHaveBeenCalledWith('c.wechatId ILIKE :wechatIdFilter', {
      wechatIdFilter: '%abc%',
    });
    expect(andWhere).toHaveBeenCalledWith('c.lineId ILIKE :lineIdFilter', {
      lineIdFilter: '%line%',
    });
  });

  it('skips wechatId and lineId filters when values are blank after trim', () => {
    const { andWhere, asQb } = createQueryBuilderMock();
    const query = {
      wechatId: '   ',
      lineId: '',
    } as QueryCustomerDto;

    applyCustomerListFiltersToQueryBuilder(
      asQb(),
      query,
      todayStr,
      supplementLogCaseIds,
      resolvedAll,
    );

    expect(andWhere).not.toHaveBeenCalled();
  });
});

describe('applyCustomerListFiltersToQueryBuilder · residenceExpireWithinDays', () => {
  const supplementLogCaseIds: string[] = [];
  const resolvedAll: ResolvedVisaDataScope = { mode: 'all' };

  it('applies residenceExpireWithinDays using person_info upper bound date', () => {
    const { andWhere, asQb } = createQueryBuilderMock();
    const query = {
      residenceExpireWithinDays: 90,
    } as QueryCustomerDto;

    applyCustomerListFiltersToQueryBuilder(
      asQb(),
      query,
      '2026-04-04',
      supplementLogCaseIds,
      resolvedAll,
    );

    expect(andWhere).toHaveBeenCalledWith('pi.residenceExpireDate IS NOT NULL');
    expect(andWhere).toHaveBeenCalledWith(
      'pi.residenceExpireDate <= :residenceExpireUpper',
      { residenceExpireUpper: '2026-07-03' },
    );
  });
});

describe('applyCustomerListFiltersToQueryBuilder · visaCaseTypeKeyword', () => {
  const todayStr = '2026-04-04';
  const supplementLogCaseIds: string[] = [];
  const resolvedAll: ResolvedVisaDataScope = { mode: 'all' };

  it('applies visaCaseTypeKeyword as EXISTS on non-deleted visa_cases.case_type ILIKE', () => {
    const { andWhere, asQb } = createQueryBuilderMock();
    const query = {
      visaCaseTypeKeyword: '技術',
    } as QueryCustomerDto;

    applyCustomerListFiltersToQueryBuilder(
      asQb(),
      query,
      todayStr,
      supplementLogCaseIds,
      resolvedAll,
    );

    expect(andWhere).toHaveBeenCalledWith(VISA_CASE_TYPE_EXISTS_SQL, {
      vctCaseTypeKw: '%技術%',
    });
  });

  it('trims visaCaseTypeKeyword before applying EXISTS', () => {
    const { andWhere, asQb } = createQueryBuilderMock();
    const query = {
      visaCaseTypeKeyword: '  work  ',
    } as QueryCustomerDto;

    applyCustomerListFiltersToQueryBuilder(
      asQb(),
      query,
      todayStr,
      supplementLogCaseIds,
      resolvedAll,
    );

    expect(andWhere).toHaveBeenCalledWith(VISA_CASE_TYPE_EXISTS_SQL, {
      vctCaseTypeKw: '%work%',
    });
  });

  it('skips visaCaseTypeKeyword filter when blank after trim', () => {
    const { andWhere, asQb } = createQueryBuilderMock();
    const query = {
      visaCaseTypeKeyword: '   ',
    } as QueryCustomerDto;

    applyCustomerListFiltersToQueryBuilder(
      asQb(),
      query,
      todayStr,
      supplementLogCaseIds,
      resolvedAll,
    );

    expect(andWhere).not.toHaveBeenCalled();
  });
});

describe('applyCustomerListFiltersToQueryBuilder · listPrimaryVisaCaseStatus', () => {
  const todayStr = '2026-04-04';
  const supplementLogCaseIds: string[] = [];

  it('applies DISTINCT ON EXISTS and merges mine-scope parameters', () => {
    const { andWhere, setParameter, asQb } = createQueryBuilderMock();
    const query = {
      listPrimaryVisaCaseStatus: VisaCaseStatus.SUPPLEMENT,
    } as QueryCustomerDto;

    applyCustomerListFiltersToQueryBuilder(
      asQb(),
      query,
      todayStr,
      supplementLogCaseIds,
      { mode: 'mine', userId: 'user-mine' },
    );

    expect(andWhere).toHaveBeenCalledWith(
      expect.stringContaining('SELECT DISTINCT ON (vpc.customer_id)'),
      expect.objectContaining({ pclpWantStatus: VisaCaseStatus.SUPPLEMENT }),
    );
    expect(setParameter).toHaveBeenCalledWith('pclpVdsMine', 'user-mine');
  });

  it('applies listPrimaryIsFamilyCase without status using same DISTINCT ON shape', () => {
    const { andWhere, asQb } = createQueryBuilderMock();
    const query = {
      listPrimaryIsFamilyCase: true,
    } as QueryCustomerDto;

    applyCustomerListFiltersToQueryBuilder(
      asQb(),
      query,
      todayStr,
      supplementLogCaseIds,
      { mode: 'all' },
    );

    expect(andWhere).toHaveBeenCalledWith(
      expect.stringContaining('prim.pclp_ifc = :pclpWantFamily'),
      expect.objectContaining({ pclpWantFamily: true }),
    );
  });

  it('merges listPrimaryVisaCaseStatus with listPrimaryFamilyLinkMode in one EXISTS', () => {
    const { andWhere, asQb } = createQueryBuilderMock();
    const query = {
      listPrimaryVisaCaseStatus: VisaCaseStatus.IN_PROGRESS,
      listPrimaryFamilyLinkMode: FamilyLinkMode.INTERNAL,
    } as QueryCustomerDto;

    applyCustomerListFiltersToQueryBuilder(
      asQb(),
      query,
      todayStr,
      supplementLogCaseIds,
      { mode: 'all' },
    );

    expect(andWhere).toHaveBeenCalledWith(
      expect.stringContaining('prim.pclp_cs = :pclpWantStatus'),
      expect.objectContaining({
        pclpWantStatus: VisaCaseStatus.IN_PROGRESS,
        pclpWantFlm: FamilyLinkMode.INTERNAL,
      }),
    );
  });
});

describe('applyCustomerListFiltersToQueryBuilder · primaryCustomerId', () => {
  const todayStr = '2026-04-04';
  const supplementLogCaseIds: string[] = [];
  const resolvedAll: ResolvedVisaDataScope = { mode: 'all' };

  it('applies person_info primaryCustomerId and isFamilyMember when primaryCustomerId is set', () => {
    const { andWhere, asQb } = createQueryBuilderMock();
    const primaryId = 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee';
    const query = {
      primaryCustomerId: primaryId,
    } as QueryCustomerDto;

    applyCustomerListFiltersToQueryBuilder(
      asQb(),
      query,
      todayStr,
      supplementLogCaseIds,
      resolvedAll,
    );

    expect(andWhere).toHaveBeenCalledWith(
      'pi.primaryCustomerId = :familyOfPrimaryCustomerId',
      { familyOfPrimaryCustomerId: primaryId },
    );
    expect(andWhere).toHaveBeenCalledWith(
      'pi.isFamilyMember = :familyMemberOnlyTrue',
      { familyMemberOnlyTrue: true },
    );
  });
});
