import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { VisaDataScope } from '../../common/constants/enums';
import { PermissionCodes } from '../../common/constants/permission-codes';
import { User } from '../auth/entities/user.entity';
import { VisaCaseDataScopeService } from './visa-case-data-scope.service';
import { VisaCaseDataScopePermissionService } from './visa-case-data-scope-permission.service';

let service: VisaCaseDataScopePermissionService;
let userRepo: jest.Mocked<Pick<Repository<User>, 'findOne'>>;
let dataScopeResolve: jest.Mock;

/**
 * 重置权限服务与关联 mock，供各 `describe` 共用。
 *
 * @returns 编译测试模块后的 Promise
 */
async function resetVisaCaseDataScopePermissionFixture(): Promise<void> {
  dataScopeResolve = jest.fn();
  userRepo = { findOne: jest.fn() };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      VisaCaseDataScopePermissionService,
      { provide: getRepositoryToken(User), useValue: userRepo },
      {
        provide: VisaCaseDataScopeService,
        useValue: { resolve: dataScopeResolve },
      },
    ],
  }).compile();

  service = module.get(VisaCaseDataScopePermissionService);
}

function expectGetMaxAllowedMissingDataScopeDefaultsToAll(): void {
  expect(service.getMaxAllowedVisaDataScope(new Set(['visaCase:list']))).toBe(
    VisaDataScope.ALL,
  );
}

function expectGetMaxAllowedWhenAllCodePresent(): void {
  const p = new Set([
    PermissionCodes.VISA_CASE_DATA_SCOPE_MINE,
    PermissionCodes.VISA_CASE_DATA_SCOPE_ALL,
  ]);
  expect(service.getMaxAllowedVisaDataScope(p)).toBe(VisaDataScope.ALL);
}

function expectGetMaxAllowedTeamOnly(): void {
  const p = new Set([PermissionCodes.VISA_CASE_DATA_SCOPE_TEAM]);
  expect(service.getMaxAllowedVisaDataScope(p)).toBe(VisaDataScope.TEAM);
}

function expectGetMaxAllowedMineOnly(): void {
  const p = new Set([PermissionCodes.VISA_CASE_DATA_SCOPE_MINE]);
  expect(service.getMaxAllowedVisaDataScope(p)).toBe(VisaDataScope.MINE);
}

function expectGetMaxAllowedGlobalStar(): void {
  expect(service.getMaxAllowedVisaDataScope(new Set(['*']))).toBe(
    VisaDataScope.ALL,
  );
}

function expectGetMaxAllowedVisaCaseStar(): void {
  expect(service.getMaxAllowedVisaDataScope(new Set(['visaCase:*']))).toBe(
    VisaDataScope.ALL,
  );
}

function expectQueryAllowsMineWhenMaxIsTeam(): void {
  const p = new Set([PermissionCodes.VISA_CASE_DATA_SCOPE_TEAM]);
  expect(() =>
    service.assertQueryDataScopeAllowed(p, VisaDataScope.MINE),
  ).not.toThrow();
}

function expectQueryForbidsAllWhenMaxIsMine(): void {
  const p = new Set([PermissionCodes.VISA_CASE_DATA_SCOPE_MINE]);
  expect(() =>
    service.assertQueryDataScopeAllowed(p, VisaDataScope.ALL),
  ).toThrow(ForbiddenException);
}

function expectQueryForbidsTeamWhenMaxIsMine(): void {
  const p = new Set([PermissionCodes.VISA_CASE_DATA_SCOPE_MINE]);
  expect(() =>
    service.assertQueryDataScopeAllowed(p, VisaDataScope.TEAM),
  ).toThrow(ForbiddenException);
}

async function expectRowReadOutsideMineScopeThrowsNotFound(): Promise<void> {
  userRepo.findOne.mockResolvedValue({
    id: 'u1',
    roles: [{ permissions: [{ permissionCode: 'visaCase:dataScopeMine' }] }],
  } as unknown as User);

  dataScopeResolve.mockResolvedValue({
    mode: 'mine',
    userId: 'u1',
  });

  await expect(
    service.assertVisaCaseRowAccessible('u1', 'other-user', 'read'),
  ).rejects.toThrow(NotFoundException);
}

async function expectRowWriteOutsideMineScopeThrowsForbidden(): Promise<void> {
  userRepo.findOne.mockResolvedValue({
    id: 'u1',
    roles: [{ permissions: [{ permissionCode: 'visaCase:dataScopeMine' }] }],
  } as unknown as User);

  dataScopeResolve.mockResolvedValue({
    mode: 'mine',
    userId: 'u1',
  });

  await expect(
    service.assertVisaCaseRowAccessible('u1', 'other-user', 'write'),
  ).rejects.toThrow(ForbiddenException);
}

async function expectRowReadWithinMineScopeResolves(): Promise<void> {
  userRepo.findOne.mockResolvedValue({
    id: 'u1',
    roles: [{ permissions: [{ permissionCode: 'visaCase:dataScopeMine' }] }],
  } as unknown as User);

  dataScopeResolve.mockResolvedValue({
    mode: 'mine',
    userId: 'u1',
  });

  await expect(
    service.assertVisaCaseRowAccessible('u1', 'u1', 'read'),
  ).resolves.toBeUndefined();
}

beforeEach(async () => {
  await resetVisaCaseDataScopePermissionFixture();
});

describe('VisaCaseDataScopePermissionService', () => {
  describe('getMaxAllowedVisaDataScope', () => {
    it('treats missing dataScope permissions as all (backward compatible)', () =>
      expectGetMaxAllowedMissingDataScopeDefaultsToAll());

    it('returns ALL when visaCase:dataScopeAll is present', () =>
      expectGetMaxAllowedWhenAllCodePresent());

    it('returns TEAM when only team (and maybe mine) is present', () =>
      expectGetMaxAllowedTeamOnly());

    it('returns MINE when only mine scope permission is present', () =>
      expectGetMaxAllowedMineOnly());

    it('treats global * as ALL', () => expectGetMaxAllowedGlobalStar());

    it('treats visaCase:* as ALL', () => expectGetMaxAllowedVisaCaseStar());
  });

  describe('assertQueryDataScopeAllowed', () => {
    it('allows mine when max is TEAM', () =>
      expectQueryAllowsMineWhenMaxIsTeam());

    it('forbids all when max is MINE', () =>
      expectQueryForbidsAllWhenMaxIsMine());

    it('forbids team when max is MINE', () =>
      expectQueryForbidsTeamWhenMaxIsMine());
  });

  describe('assertVisaCaseRowAccessible', () => {
    it('read mode throws NotFound when row outside resolved scope', () =>
      expectRowReadOutsideMineScopeThrowsNotFound());

    it('write mode throws Forbidden when row outside resolved scope', () =>
      expectRowWriteOutsideMineScopeThrowsForbidden());

    it('resolves when assigned row matches mine scope', () =>
      expectRowReadWithinMineScopeResolves());
  });
});
